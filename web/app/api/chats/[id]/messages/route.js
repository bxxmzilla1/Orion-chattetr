import { getChat, upsertChat, normalizeMessage } from "../../../../../lib/store.js";
import { describeMedia } from "../../../../../lib/grok.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Grok vision on media can take a while

// Public: a visitor sends a message (text and/or media). The server analyzes
// media with Grok vision (so the operator's chatbot understands it), stores
// the message, and bumps the unread counter. Replies come from the Electron
// app — the chat page polls the transcript to pick them up.
export async function POST(request, { params }) {
  try {
    const chat = await getChat(params.id);
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const content = String(body.content || "").trim();
    const mediaIn = body.media || null; // { kind, url, fileName }
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, 6) : [];

    if (!content && !mediaIn) {
      return Response.json({ error: "Empty message" }, { status: 400 });
    }

    let media = null;
    if (mediaIn && (mediaIn.url || frames.length)) {
      const kind = mediaIn.kind === "video" ? "video" : "image";
      let description = "";
      const sources = frames.length ? frames : mediaIn.url ? [mediaIn.url] : [];
      if (sources.length) {
        try {
          const result = await describeMedia({
            kind,
            imageUrls: sources,
            fileName: mediaIn.fileName || "",
          });
          if (result.description) description = result.description;
        } catch {
          // No description is fine — the message still gets stored.
        }
      }
      media = {
        kind,
        url: mediaIn.url || null,
        fileName: mediaIn.fileName || "",
        description,
      };
    }

    const msg = normalizeMessage({
      role: "fan",
      content,
      at: new Date().toISOString(),
      media,
    });
    if (!msg) return Response.json({ error: "Empty message" }, { status: 400 });

    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    chat.messages.push(msg);
    chat.lastMessage =
      content || (media?.kind === "video" ? "sent a video" : "sent a photo");
    chat.lastMessageAt = msg.at;
    chat.unread = (Number(chat.unread) || 0) + 1;
    await upsertChat(chat);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
