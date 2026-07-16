import { isAdmin, unauthorized } from "../../../lib/auth.js";
import { listChats, upsertChat, newChatId } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const chats = await listChats();
    return Response.json({ chats });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    const id = newChatId();
    const chat = await upsertChat({
      id,
      name: String(body.name || "").trim() || "Unknown",
      username: String(body.username || "").trim(),
      persona: String(body.persona || "").trim(),
      messages: [],
      unread: 0,
    });
    return Response.json({ chat });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
