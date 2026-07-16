import { supabase } from "./supabase.js";
import { normalizeJournal } from "./journal.js";

// ---- chats -----------------------------------------------------------------
function mapChat(row) {
  return {
    id: String(row.id),
    name: row.name || "Unknown",
    username: row.username || "",
    avatar: row.avatar || "",
    persona: row.persona || "",
    unread: Number(row.unread) || 0,
    lastMessage: row.last_message || "",
    lastMessageAt: row.last_message_at || null,
    messages: Array.isArray(row.messages) ? row.messages : [],
    suggestion: row.suggestion || "",
    analyzedAt: row.analyzed_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function listChats() {
  const { data, error } = await supabase()
    .from("chats")
    .select(
      "id,name,username,avatar,unread,last_message,last_message_at,analyzed_at,updated_at"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapChat);
}

export async function getChat(id) {
  const { data, error } = await supabase()
    .from("chats")
    .select("*")
    .eq("id", String(id))
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapChat(data) : null;
}

export async function upsertChat(chat) {
  const row = {
    id: String(chat.id),
    name: chat.name || "Unknown",
    username: chat.username || "",
    avatar: chat.avatar || "",
    persona: chat.persona || "",
    unread: Number(chat.unread) || 0,
    last_message: chat.lastMessage || "",
    last_message_at: chat.lastMessageAt || null,
    messages: Array.isArray(chat.messages) ? chat.messages : [],
    suggestion: chat.suggestion || "",
    analyzed_at: chat.analyzedAt || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase()
    .from("chats")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapChat(data || row);
}

export async function deleteChat(id) {
  await supabase().from("chats").delete().eq("id", String(id));
}

export function newChatId() {
  return `c_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizeMessage(m) {
  if (!m || typeof m !== "object") return null;
  const role = m.role === "me" || m.role === "assistant" ? "me" : "fan";
  const content = String(m.content || "").trim();
  const media = m.media || null;
  if (!content && !media) return null;
  return { role, content, at: m.at || new Date().toISOString(), media };
}

// ---- memory_profiles -------------------------------------------------------
export async function loadMemory(key) {
  const { data, error } = await supabase()
    .from("memory_profiles")
    .select("*")
    .eq("key", key)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { journal: [], profile: "", lastSceneCheckAt: null };
  return {
    journal: normalizeJournal(data.journal),
    profile: typeof data.profile === "string" ? data.profile : "",
    lastSceneCheckAt: data.last_scene_check_at || null,
  };
}

export async function saveMemory(key, memory) {
  const payload = {
    key,
    journal: normalizeJournal(memory.journal),
    profile: typeof memory.profile === "string" ? memory.profile : "",
    last_scene_check_at: memory.lastSceneCheckAt || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase()
    .from("memory_profiles")
    .upsert(payload, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return {
    journal: payload.journal,
    profile: payload.profile,
    lastSceneCheckAt: payload.last_scene_check_at,
  };
}

export function chatMemoryKey(chatId) {
  return `inbox:${chatId}`;
}

// ---- app-wide settings (default persona) -----------------------------------
export async function getAppSetting(key, fallback = "") {
  const { data, error } = await supabase()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .limit(1)
    .maybeSingle();
  if (error) return fallback;
  return data?.value ?? fallback;
}

export async function setAppSetting(key, value) {
  const { error } = await supabase()
    .from("app_settings")
    .upsert(
      { key, value: String(value ?? ""), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw new Error(error.message);
}
