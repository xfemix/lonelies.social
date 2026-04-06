const { Pool } = require('pg');

let pool;

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

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = async function handler(req, res) {
  const baseUrl = 'https://lonelies.social';

  let client;
  try {
    client = await getPool().connect();

    const postsResult = await client.query(
      `
        SELECT id, created_at
        FROM letters
        ORDER BY created_at DESC
        LIMIT 500
      `
    );

    const homeUrl = `<url><loc>${xmlEscape(baseUrl + '/')}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;

    const postUrls = postsResult.rows
      .map((post) => {
        const datePart = new Date(post.created_at).toISOString().slice(0, 10);
        const shareLoc = `${baseUrl}/?post=${encodeURIComponent(String(post.id))}`;
        return `<url><loc>${xmlEscape(shareLoc)}</loc><lastmod>${datePart}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      })
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${homeUrl}${postUrls}</urlset>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(xml);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  } finally {
    if (client) client.release();
  }
};
