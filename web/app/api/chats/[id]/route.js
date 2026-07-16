import { isAdmin, unauthorized } from "../../../../lib/auth.js";
import { getChat, deleteChat, getAppSetting } from "../../../../lib/store.js";

export const dynamic = "force-dynamic";

// Public: the chat page uses this to load the transcript. Only expose what a
// visitor should see (no suggestion/analyze internals).
export async function GET(request, { params }) {
  try {
    const chat = await getChat(params.id);
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });
    const girlName = await getAppSetting("girl_name", "Orion");
    return Response.json({
      chat: {
        id: chat.id,
        // The visitor sees HER identity, never the internal fan label.
        name: girlName,
        avatar: chat.avatar,
        messages: (chat.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          at: m.at,
          media: m.media
            ? { kind: m.media.kind, url: m.media.url || null }
            : null,
        })),
      },
    });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!isAdmin(request)) return unauthorized();
  try {
    await deleteChat(params.id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
