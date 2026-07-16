import { getChat } from "../../../../../lib/store.js";
import { describeMedia } from "../../../../../lib/grok.js";
import { generateReply } from "../../../../../lib/reply.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Grok reply + journal update can take a while

// Public: a visitor sends a message (text and/or media). The server analyzes
// media with Grok vision, generates the girl's reply, saves everything, and
// returns the reply bubbles with human typing delays.
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
        const result = await describeMedia({
          kind,
          imageUrls: sources,
          fileName: mediaIn.fileName || "",
        });
        if (result.description) description = result.description;
      }
      media = {
        kind,
        url: mediaIn.url || null,
        fileName: mediaIn.fileName || "",
        description,
      };
    }

    const bubbles = await generateReply({
      chatId: params.id,
      fanMessage: { content, media },
    });

    return Response.json({ bubbles });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
