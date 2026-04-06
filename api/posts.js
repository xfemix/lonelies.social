const { Pool } = require('pg');

let pool;
const requestBuckets = new Map();

const WINDOW_MS = 60 * 1000;
const CREATE_LIMIT_PER_WINDOW = 20;
const READ_LIMIT_PER_WINDOW = 120;
const FETCH_LIMIT_PER_WINDOW = 180;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[0]).trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(req, key, limit) {
  const ip = getClientIp(req);
  const bucketKey = `${ip}:${key}`;
  const now = Date.now();

  let bucket = requestBuckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
  }

  bucket.count += 1;
  requestBuckets.set(bucketKey, bucket);

  if (requestBuckets.size > 10000) {
    for (const [savedKey, savedBucket] of requestBuckets.entries()) {
      if (now > savedBucket.resetAt) requestBuckets.delete(savedKey);
    }
  }

  return bucket.count > limit;
}

function coerceDateRange(dateValue, endOfDay = false) {
  if (typeof dateValue !== 'string') return null;
  const normalized = dateValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return endOfDay ? `${normalized}T23:59:59.999Z` : `${normalized}T00:00:00.000Z`;
}

function getPool() {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  return pool;
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS letters (
      id BIGSERIAL PRIMARY KEY,
      nickname TEXT,
      letter TEXT NOT NULL,
      read_count BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS read_count BIGINT NOT NULL DEFAULT 0;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS letters_created_at_idx ON letters (created_at DESC);
  `);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  let client;
  try {
    client = await getPool().connect();
    await ensureTable(client);

    if (req.method === 'GET') {
      if (isRateLimited(req, 'fetch', FETCH_LIMIT_PER_WINDOW)) {
        return sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
      }

      const queryParts = [];
      const values = [];

      const searchRaw = typeof req.query?.search === 'string' ? req.query.search.trim() : '';
      const fromRaw = typeof req.query?.from === 'string' ? req.query.from.trim() : '';
      const toRaw = typeof req.query?.to === 'string' ? req.query.to.trim() : '';
      const sortRaw = typeof req.query?.sort === 'string' ? req.query.sort.toLowerCase() : 'desc';

      const search = searchRaw.slice(0, 120);
      const fromDate = coerceDateRange(fromRaw, false);
      const toDate = coerceDateRange(toRaw, true);
      const sort = sortRaw === 'asc' ? 'ASC' : 'DESC';

      if (search) {
        values.push(`%${search}%`);
        queryParts.push(`(letter ILIKE $${values.length} OR nickname ILIKE $${values.length})`);
      }

      if (fromDate) {
        values.push(fromDate);
        queryParts.push(`created_at >= $${values.length}`);
      }

      if (toDate) {
        values.push(toDate);
        queryParts.push(`created_at <= $${values.length}`);
      }

      const whereClause = queryParts.length ? `WHERE ${queryParts.join(' AND ')}` : '';
      const result = await client.query(
        `
          SELECT id, nickname, letter, read_count, created_at
          FROM letters
          ${whereClause}
          ORDER BY created_at ${sort}
          LIMIT 200
        `,
        values
      );

      return sendJson(res, 200, { posts: result.rows });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (body.action === 'read') {
      if (isRateLimited(req, 'read', READ_LIMIT_PER_WINDOW)) {
        return sendJson(res, 429, { error: 'Too many read-count updates. Please slow down.' });
      }

      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) {
        return sendJson(res, 400, { error: 'Invalid post id.' });
      }

      const update = await client.query(
        `
          UPDATE letters
          SET read_count = read_count + 1
          WHERE id = $1
          RETURNING id, read_count
        `,
        [id]
      );

      if (!update.rows.length) {
        return sendJson(res, 404, { error: 'Post not found.' });
      }

      return sendJson(res, 200, {
        id: update.rows[0].id,
        read_count: Number(update.rows[0].read_count),
      });
    }

    if (isRateLimited(req, 'create', CREATE_LIMIT_PER_WINDOW)) {
      return sendJson(res, 429, { error: 'Too many posts in a short time. Please wait.' });
    }

    const nicknameRaw = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const letterRaw = typeof body.letter === 'string' ? body.letter.trim() : '';

    if (!letterRaw) {
      return sendJson(res, 400, { error: 'Letter cannot be empty.' });
    }

    if (letterRaw.length > 10000) {
      return sendJson(res, 400, { error: 'Letter is too long (max 10000 characters).' });
    }

    const nickname = nicknameRaw.slice(0, 40) || null;
    const letter = letterRaw;

    const insert = await client.query(
      `
        INSERT INTO letters (nickname, letter)
        VALUES ($1, $2)
        RETURNING id, nickname, letter, read_count, created_at
      `,
      [nickname, letter]
    );

    return sendJson(res, 201, { post: insert.rows[0] });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      error: 'Server error. Check database configuration.',
    });
  } finally {
    if (client) client.release();
  }
};
