# Orion Web

The public chat pages for the Orion desktop app. You create chats and links in
the Electron app; Vercel just hosts the page fans open. Everything they send
lands in the same Supabase project, so it shows up in the desktop Inbox where
you analyze and send her replies.

## How it works

- `/c/<chatId>` — the chat page you share. Fans text her and send
  photos/videos. Messages are stored in Supabase and bump the unread counter;
  the desktop Inbox picks them up automatically.
- Replies are NOT generated here. You reply from the Electron app (Analyze →
  Send), and the chat page polls the transcript so her messages appear live.
- Media goes straight from the browser to Supabase Storage via signed upload
  URLs. Videos are sampled into frames client-side and described with Grok
  vision so the chatbot in the desktop app knows what he sent.
- `/` is intentionally empty — there is no web admin.

## Setup

1. **Supabase** — run `../supabase-schema.sql` in the SQL editor (it creates
   `chats`, `memory_profiles`, `app_settings`, and the public `orion-media`
   storage bucket).
2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `XAI_API_KEY` (and optionally `XAI_MODEL`, default `grok-4`) — only used
     to describe media fans send
3. **Run locally**

```bash
cd web
npm install
npm run dev
```

## Deploy to Vercel

Push the repo to GitHub and import it in the Vercel dashboard — set the
**Root Directory** to `web`. Add the environment variables in
Project Settings → Environment Variables, then deploy.

Then in the Electron app, open Settings and paste the deployment URL into
**Chat page URL**. Every "New chat" now copies a share link like
`https://yourapp.vercel.app/c/<chatId>`.
