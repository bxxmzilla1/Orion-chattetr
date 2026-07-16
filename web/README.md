# Orion Web

The Orion companion as a standalone web app for Vercel. Create a chat, share
the link, and visitors chat with her in the browser — texts, photos, and
videos. Uses the same Supabase project as the Electron app, so web chats also
show up in the desktop Inbox with their journals.

## How it works

- `/` — admin console (passcode-protected). Create chats, copy share links,
  delete chats, edit the default persona.
- `/c/<chatId>` — the public chat page you share. Visitors text her and send
  photos/videos; Grok "watches" the media, she reacts in character, and a
  psychological journal builds automatically in `memory_profiles`
  (key `inbox:<chatId>`).
- Media goes straight from the browser to Supabase Storage via signed upload
  URLs (no Vercel size limits). Videos are sampled into frames client-side so
  Grok vision can describe them.

## Setup

1. **Supabase** — run `../supabase-schema.sql` in the SQL editor (it creates
   `chats`, `memory_profiles`, `app_settings`, and the public `orion-media`
   storage bucket).
2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `XAI_API_KEY` (and optionally `XAI_MODEL`, default `grok-4`)
   - `ADMIN_PASSCODE` — the passcode for the admin page
   - `NEXT_PUBLIC_SITE_URL` — optional, e.g. `https://yourapp.vercel.app`
3. **Run locally**

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000, enter your passcode, create a chat, open the link.

## Deploy to Vercel

```bash
cd web
npx vercel
```

Or push the repo to GitHub and import it in the Vercel dashboard — set the
**Root Directory** to `web`. Add the same environment variables in
Project Settings → Environment Variables, then deploy. Share links look like
`https://yourapp.vercel.app/c/<chatId>`.

Note: reply generation calls Grok twice (reply + journal update), which can
take 20–60s. On Vercel's free plan functions cap at 60s of execution — if
replies get cut off, upgrade the plan or lower `maxDuration` expectations.
