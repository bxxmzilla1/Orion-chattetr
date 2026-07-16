import { createClient } from "@supabase/supabase-js";

let _client = null;

// Server-side Supabase client using the service role key. Never import this
// into client components — these routes run only on the server (Vercel).
export function supabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const MEDIA_BUCKET = "orion-media";
