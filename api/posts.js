const { Pool } = require('pg');

let pool;
const requestBuckets = new Map();
const recentPostFingerprints = new Map();

const WINDOW_MS = 60 * 1000;
const CREATE_LIMIT_PER_WINDOW = 20;
const READ_LIMIT_PER_WINDOW = 120;
const FETCH_LIMIT_PER_WINDOW = 180;
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
const LINK_PATTERNS = [
  /(https?:\/\/|www\.)\S+/i,
  /\[[^\]]+\]\((https?:\/\/|www\.)[^)]+\)/i,
  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|io|co|ng|me|app|dev|xyz|info|biz|site|link|ly|gg|tv|ai)\b/i,
];

function hasLink(text) {
  const source = String(text || '');
  return LINK_PATTERNS.some((pattern) => pattern.test(source));
}

function compactText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function simpleHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function isLikelySpamText(text) {
  const source = compactText(text);
  if (!source) return false;

  if (/(.)\1{13,}/.test(source)) {
    return true;
  }

  const words = source.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 12) {
    const counts = new Map();
    for (const word of words) {
      const next = (counts.get(word) || 0) + 1;
      counts.set(word, next);
      if (next >= 10 && word.length > 2) {
        return true;
      }
    }
  }

  if (source.length >= 60) {
    const uniqueChars = new Set(source.toLowerCase().replace(/\s+/g, '')).size;
    const ratio = uniqueChars / Math.max(1, source.replace(/\s+/g, '').length);
    if (ratio < 0.08) {
      return true;
    }
  }

  return false;
}

function isRecentDuplicate(ip, nickname, letter) {
  const now = Date.now();

  if (recentPostFingerprints.size > 12000) {
    for (const [key, timestamp] of recentPostFingerprints.entries()) {
      if (now - timestamp > DUPLICATE_WINDOW_MS) {
        recentPostFingerprints.delete(key);
      }
    }
  }

  const fingerprint = simpleHash(`${ip}|${compactText(nickname).toLowerCase()}|${compactText(letter).toLowerCase()}`);
  const previous = recentPostFingerprints.get(fingerprint);
  if (previous && now - previous <= DUPLICATE_WINDOW_MS) {
    return true;
  }

  recentPostFingerprints.set(fingerprint, now);
  return false;
}

async function ensureReadEventsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS letter_reads (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS letter_reads_created_at_idx ON letter_reads (created_at DESC);
  `);
}

async function getTodayReads(client) {
  const today = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM letter_reads
      WHERE created_at >= DATE_TRUNC('day', NOW())
    `
  );
  return Number(today.rows[0]?.total || 0);
}

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
    await ensureReadEventsTable(client);

    if (req.method === 'GET') {
      if (isRateLimited(req, 'fetch', FETCH_LIMIT_PER_WINDOW)) {
        return sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
      }

      const idRaw = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
      const viewRaw = typeof req.query?.view === 'string' ? req.query.view.trim().toLowerCase() : '';

      if (idRaw) {
        const id = Number(idRaw);
        if (!Number.isInteger(id) || id <= 0) {
          return sendJson(res, 400, { error: 'Invalid post id.' });
        }

        const single = await client.query(
          `
            SELECT id, nickname, letter, read_count, created_at
            FROM letters
            WHERE id = $1
            LIMIT 1
          `,
          [id]
        );

        if (!single.rows.length) {
          return sendJson(res, 404, { error: 'Post not found.' });
        }

        return sendJson(res, 200, { post: single.rows[0] });
      }

      if (viewRaw === 'activity') {
        const currentUtcDate = new Date();
        const currentYear = currentUtcDate.getUTCFullYear();
        const currentMonth = currentUtcDate.getUTCMonth() + 1;
        const currentDay = currentUtcDate.getUTCDate();
        const requestedYear = Number(req.query?.year);
        const requestedMonth = Number(req.query?.month);

        const yearsResult = await client.query(
          `
            SELECT DISTINCT EXTRACT(YEAR FROM created_at)::INT AS year
            FROM letters
            ORDER BY year DESC
            LIMIT 30
          `
        );

        const years = yearsResult.rows.map((row) => Number(row.year)).filter((year) => Number.isInteger(year));
        if (!years.includes(currentYear)) years.unshift(currentYear);

        const fallbackYear = years.length ? years[0] : currentUtcDate.getUTCFullYear();
        const selectedYear = Number.isInteger(requestedYear) && requestedYear >= 1970 && requestedYear <= 2200
          ? requestedYear
          : fallbackYear;

        const monthsResult = await client.query(
          `
            SELECT DISTINCT EXTRACT(MONTH FROM created_at)::INT AS month
            FROM letters
            WHERE EXTRACT(YEAR FROM created_at) = $1
            ORDER BY month ASC
          `,
          [selectedYear]
        );

        const months = monthsResult.rows
          .map((row) => Number(row.month))
          .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);

        const monthCountsResult = await client.query(
          `
            SELECT EXTRACT(MONTH FROM created_at)::INT AS month, COUNT(*)::INT AS count
            FROM letters
            WHERE EXTRACT(YEAR FROM created_at) = $1
            GROUP BY EXTRACT(MONTH FROM created_at)
            ORDER BY month ASC
          `,
          [selectedYear]
        );

        const monthCounts = monthCountsResult.rows
          .map((row) => ({
            month: Number(row.month),
            count: Number(row.count),
          }))
          .filter((row) => Number.isInteger(row.month) && row.month >= 1 && row.month <= 12);

        const fallbackMonth = months.length ? months[months.length - 1] : currentUtcDate.getUTCMonth() + 1;
        const selectedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
          ? requestedMonth
          : fallbackMonth;

        const daysResult = await client.query(
          `
            SELECT TO_CHAR(created_at::DATE, 'YYYY-MM-DD') AS day, COUNT(*)::INT AS count
            FROM letters
            WHERE EXTRACT(YEAR FROM created_at) = $1
              AND EXTRACT(MONTH FROM created_at) = $2
            GROUP BY created_at::DATE
            ORDER BY created_at::DATE ASC
          `,
          [selectedYear, selectedMonth]
        );

        const monthTotalResult = await client.query(
          `
            SELECT COUNT(*)::INT AS total
            FROM letters
            WHERE EXTRACT(YEAR FROM created_at) = $1
              AND EXTRACT(MONTH FROM created_at) = $2
          `,
          [selectedYear, selectedMonth]
        );

        return sendJson(res, 200, {
          years,
          months,
          monthCounts,
          selectedYear,
          selectedMonth,
          days: daysResult.rows,
          monthTotal: Number(monthTotalResult.rows[0]?.total || 0),
          today: {
            year: currentYear,
            month: currentMonth,
            day: currentDay,
          },
        });
      }

      const queryParts = [];
      const values = [];

      const searchRaw = typeof req.query?.search === 'string' ? req.query.search.trim() : '';
      const fromRaw = typeof req.query?.from === 'string' ? req.query.from.trim() : '';
      const toRaw = typeof req.query?.to === 'string' ? req.query.to.trim() : '';
      const sortRaw = typeof req.query?.sort === 'string' ? req.query.sort.toLowerCase() : 'desc';
      const pageRaw = Number(req.query?.page);
      const pageSizeRaw = Number(req.query?.pageSize);

      const search = searchRaw.slice(0, 120);
      const fromDate = coerceDateRange(fromRaw, false);
      const toDate = coerceDateRange(toRaw, true);
      const sort = sortRaw === 'asc' ? 'ASC' : 'DESC';
      const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
      const pageSize = Number.isInteger(pageSizeRaw) && pageSizeRaw > 0
        ? Math.min(pageSizeRaw, 100)
        : 30;

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
      const filteredCountResult = await client.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM letters
          ${whereClause}
        `,
        values
      );

      const totalItems = Number(filteredCountResult.rows[0]?.total || 0);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * pageSize;

      const pagedValues = [...values, pageSize, offset];
      const result = await client.query(
        `
          SELECT id, nickname, letter, read_count, created_at
          FROM letters
          ${whereClause}
          ORDER BY created_at ${sort}
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        pagedValues
      );

      const totalCountResult = await client.query('SELECT COUNT(*)::INT AS total FROM letters');
      const totalLetters = Number(totalCountResult.rows[0]?.total || 0);
      const todayReads = await getTodayReads(client);

      return sendJson(res, 200, {
        posts: result.rows,
        totalLetters,
        todayReads,
        pagination: {
          page: safePage,
          pageSize,
          totalItems,
          totalPages,
          hasPrev: safePage > 1,
          hasNext: safePage < totalPages,
        },
      });
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

      await client.query(
        `
          INSERT INTO letter_reads (post_id)
          VALUES ($1)
        `,
        [id]
      );

      const todayReads = await getTodayReads(client);

      return sendJson(res, 200, {
        id: update.rows[0].id,
        read_count: Number(update.rows[0].read_count),
        todayReads,
      });
    }

    if (isRateLimited(req, 'create', CREATE_LIMIT_PER_WINDOW)) {
      return sendJson(res, 429, { error: 'Too many posts in a short time. Please wait.' });
    }

    const nicknameRaw = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const letterRaw = typeof body.letter === 'string' ? body.letter.trim() : '';
    const websiteRaw = typeof body.website === 'string' ? body.website.trim() : '';

    if (websiteRaw) {
      return sendJson(res, 400, { error: 'Spam check failed.' });
    }

    if (!letterRaw) {
      return sendJson(res, 400, { error: 'Letter cannot be empty.' });
    }

    if (letterRaw.length < 3) {
      return sendJson(res, 400, { error: 'Letter is too short.' });
    }

    if (letterRaw.length > 10000) {
      return sendJson(res, 400, { error: 'Letter is too long (max 10000 characters).' });
    }

    if (hasLink(letterRaw) || hasLink(nicknameRaw)) {
      return sendJson(res, 400, { error: 'Links are not allowed in posts.' });
    }

    if (isLikelySpamText(letterRaw)) {
      return sendJson(res, 400, { error: 'Post looks like spam. Please rewrite and try again.' });
    }

    if (isRecentDuplicate(getClientIp(req), nicknameRaw, letterRaw)) {
      return sendJson(res, 429, { error: 'Duplicate post detected. Please wait before posting again.' });
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
