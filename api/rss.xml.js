const { Pool } = require('pg');

let pool;
const FEED_MAX_ITEMS = 25;
const FEED_DELAY_HOURS = 24;
const FEED_EXCERPT_LENGTH = 120;

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

function excerpt(text, maxLength = FEED_EXCERPT_LENGTH) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trimEnd()}...`;
}

module.exports = async function handler(req, res) {
  const baseUrl = 'https://lonelies.social';

  let client;
  try {
    client = await getPool().connect();

    const postsResult = await client.query(
      `
        SELECT id, nickname, letter, created_at
        FROM letters
        WHERE created_at <= NOW() - INTERVAL '${FEED_DELAY_HOURS} hours'
        ORDER BY created_at DESC
        LIMIT ${FEED_MAX_ITEMS}
      `
    );

    const channelTitle = 'lonelies.social | Anonymous Letters';
    const channelDescription = 'Anonymous letters for venting and confessions. No login, no trackers.';
    const channelLink = `${baseUrl}/`;

    const items = postsResult.rows
      .map((post) => {
        const postId = Number(post.id);
        const postUrl = `${baseUrl}/?post=${encodeURIComponent(String(postId))}`;
        const author = post.nickname ? String(post.nickname) : 'anonymous';
        const date = new Date(post.created_at);
        const pubDate = Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
        const title = `${author} - letter #${postId}`;
        const summary = excerpt(post.letter);

        return [
          '<item>',
          `<title>${xmlEscape(title)}</title>`,
          `<link>${xmlEscape(postUrl)}</link>`,
          `<guid isPermaLink="true">${xmlEscape(postUrl)}</guid>`,
          `<pubDate>${xmlEscape(pubDate)}</pubDate>`,
          `<description>${xmlEscape(summary)}</description>`,
          '</item>',
        ].join('');
      })
      .join('');

    const rss = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '<channel>',
      `<title>${xmlEscape(channelTitle)}</title>`,
      `<link>${xmlEscape(channelLink)}</link>`,
      `<description>${xmlEscape(channelDescription)}</description>`,
      `<lastBuildDate>${xmlEscape(new Date().toUTCString())}</lastBuildDate>`,
      `<atom:link href="${xmlEscape(baseUrl + '/rss.xml')}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
      items,
      '</channel>',
      '</rss>',
    ].join('');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=14400');
    res.end(rss);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.end('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>lonelies.social | Anonymous Letters</title></channel></rss>');
  } finally {
    if (client) client.release();
  }
};
