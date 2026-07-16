import { grokFetch, grokConfig } from "./grok.js";
import { buildSystemPrompt, INBOX_REPLY_INSTRUCTION } from "./prompt.js";
import { looksLikeSceneCheck } from "./journal.js";
import {
  getChat,
  upsertChat,
  loadMemory,
  saveMemory,
  chatMemoryKey,
  getAppSetting,
} from "./store.js";
import { updateMemoryFromChat } from "./memory.js";

function splitBubbles(text) {
  return String(text || "")
    .split("|||")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

// Human-feeling typing delay per bubble (ms), like the Electron chat.
function typingDelayFor(text, index) {
  const base = index === 0 ? 900 : 600;
  const perChar = 38;
  const ms = base + Math.min(4200, text.length * perChar);
  return Math.round(ms * (0.85 + Math.random() * 0.3));
}

function historyContent(m) {
  if (m.media && m.media.description) {
    const label = m.media.kind === "video" ? "a video" : "a photo";
    const caption = m.content ? `He also wrote: "${m.content}"\n\n` : "";
    return `[He just sent you ${label}.]\n${caption}What you can see in it:\n${m.media.description}`;
  }
  return m.content || "";
}

// Full pipeline for one fan message: save it, generate the girl's reply,
// save the reply bubbles, update the journal, return bubbles + delays.
export async function generateReply({ chatId, fanMessage }) {
  const chat = await getChat(chatId);
  if (!chat) throw new Error("Chat not found.");

  const now = new Date().toISOString();
  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
  chat.messages.push({ ...fanMessage, role: "fan", at: now });

  const memoryKey = chatMemoryKey(chat.id);
  const memory = await loadMemory(memoryKey);
  const persona =
    (chat.persona || "").trim() || (await getAppSetting("persona", ""));
  const userName = chat.name && chat.name !== "Unknown" ? chat.name : "him";

  const systemPrompt = buildSystemPrompt(userName, persona, memory);
  const history = chat.messages.slice(-40).map((m) => ({
    role: m.role === "fan" ? "user" : "assistant",
    content: historyContent(m),
  }));

  const { model } = grokConfig();
  const res = await grokFetch({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: INBOX_REPLY_INSTRUCTION },
    ],
    temperature: 0.9,
    max_tokens: 700,
    stream: false,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const replyText = data.choices?.[0]?.message?.content?.trim() || "";
  const bubbles = splitBubbles(replyText);
  if (!bubbles.length) throw new Error("Empty reply from Grok.");

  const replyAt = new Date().toISOString();
  for (const b of bubbles) {
    chat.messages.push({ role: "me", content: b, at: replyAt, media: null });
  }
  chat.lastMessage = bubbles[bubbles.length - 1];
  chat.lastMessageAt = replyAt;
  chat.unread = 0;
  await upsertChat(chat);

  // Track scene-check timing so the bot doesn't nag about being alone.
  if (bubbles.some((b) => looksLikeSceneCheck(b))) {
    await saveMemory(memoryKey, { ...memory, lastSceneCheckAt: replyAt });
  }

  // Feed the journal (await — serverless functions can't run in background).
  try {
    await updateMemoryFromChat({
      userName,
      messages: chat.messages.slice(0, -bubbles.length),
      reply: bubbles.join(" "),
      memoryKey,
    });
  } catch {
    // journal update failing should never block the reply
  }

  return bubbles.map((text, i) => ({
    text,
    delay: typingDelayFor(text, i),
  }));
}
