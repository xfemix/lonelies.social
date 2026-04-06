# lonelies.social
official repo for lonelies.social

Anonymous retro letter archive for lonely people.

## What it does

- No accounts and no login.
- Optional nickname, or post as anonymous.
- Long and short letters supported.
- Letters are stored permanently in Postgres.
- Read count increases when visitors click `Read +1` on a letter.
- Archive includes search plus date range filtering.
- Browser state is not persisted by this app (no localStorage, no cookies).
- Warns users before leaving/reloading with unsent draft text.

## Stack

- Static frontend: `public/index.html`, `public/styles.css`, `public/app.js`
- API endpoint: `api/posts.js` (Vercel Serverless Function)
- Database: any free Postgres (recommended: Neon free tier or Supabase free tier)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in project root:

   ```bash
   DATABASE_URL="postgres://USER:PASSWORD@HOST/DATABASE?sslmode=require"
   ```

3. Run locally:

   ```bash
   npm run dev
   ```

4. Open the local URL shown by Vercel dev server.

## Deploy on Vercel (free)

1. Push this folder to GitHub.
2. Import the repository in Vercel.
3. In Vercel project settings, add env var `DATABASE_URL`.
4. Deploy.

The `letters` table is created automatically on first API request.

## Privacy notes

- This app does not add analytics, trackers, cookies, or auth.
- Data still goes through your hosting provider and database provider.
- If you need stronger legal/privacy guarantees, add a policy page and review provider logs/settings.

## Security and scraping FAQ

- Database credentials are server-side only: `DATABASE_URL` is used in the Vercel function, not shipped to browser JS.
- Users cannot read env vars from frontend unless you accidentally expose them as public variables.
- This app adds basic anti-abuse limits in the API (rate limiting per IP in-memory per server instance).
- `robots.txt` and `meta robots` are set to discourage indexing/scraping by compliant bots.
- Important: no public website can fully prevent scraping. For stronger defense, add Cloudflare bot protection and/or CAPTCHA on posting endpoints.
