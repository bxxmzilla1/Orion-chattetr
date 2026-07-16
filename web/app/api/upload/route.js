import { supabase, MEDIA_BUCKET } from "../../../lib/supabase.js";
import { getChat } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

// Public: gives the chat page a signed upload URL so photos/videos go straight
// from the browser to Supabase Storage (no Vercel body-size limits).
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const chatId = String(body.chatId || "").trim();
    const fileName = String(body.fileName || "file").replace(/[^\w.\-]+/g, "_");

    const chat = chatId ? await getChat(chatId) : null;
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });

    const path = `${chatId}/${Date.now().toString(36)}_${fileName}`;
    const sb = supabase();
    const { data, error } = await sb.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);

    const { data: pub } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path);

    return Response.json({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: pub.publicUrl,
    });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
