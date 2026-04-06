# lonelies.social

> Drop a letter. No one knows it was you.

An anonymous letter archive for lonely people. Write what you've been sitting on. Read what others left behind. No login, no trackers, no identity.

---

## What It Is

lonelies.social is a public archive of anonymous letters. Anyone can write one. Anyone can read them. The archive is searchable and browsable by date - you can go back in time and see what people were feeling on any given day.

It is not a social network. There are no profiles, no followers, no likes. Just letters and the people who wrote them, unnamed.

---

## How It Works

- Write a letter - with a nickname or without one
- It gets added to the archive immediately
- Others can read it, search for it, or stumble on it browsing the calendar
- Close the tab and you're gone. The letter isn't.

---

## Privacy

We don't track you. Here's what that actually means:

- No cookies
- No analytics (no Google Analytics, no Plausible, nothing)
- No login or account creation
- No IP addresses stored in our database
- No external scripts loading in the browser

The frontend code is open source - you can verify this yourself. Nothing is hidden.

**One honest caveat:** Like every website on the internet, our hosting infrastructure (Vercel) retains standard server logs. We don't control that and we don't access it. If you need genuine untraceability, use a VPN. That's on you, not us.

---

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript - deployed on Vercel
- **Backend:** Vercel Serverless Functions (API routes)
- **Database:** Neon (serverless Postgres)

---

## Running Locally

```bash
git clone https://github.com/xfemix/lonelies.social.git
cd lonelies.social
```

Create a `.env` file:

```env
DATABASE_URL=your_neon_connection_string
```

Install and run:

```bash
npm install
vercel dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |

Never commit `.env` to the repo.

---

## Content Policy

lonelies.social is for emotional expression. It is text-only - no images, no links, no media. This is intentional.

We don't moderate tone. People are allowed to be unhinged, sad, angry, raw, and honest. That's the point.

We will remove content that:
- Targets a specific real person with identifying information
- Contains content that endangers minors in any way

To report something, contact: [femi.name.ng](https://femi.name.ng)

---

## Contributing

PRs are welcome. If you find a bug or have a feature idea, open an issue.

If you want to contribute but don't know where to start:
- Improve accessibility
- Improve mobile layout
- Suggest moderation tooling

---

## Support

If this archive made you feel less alone, share it with someone who needs it.

---

## License

MIT - do what you want with the code. The letters belong to the people who wrote them.

---

*Built by [femi](https://femi.name.ng)*
