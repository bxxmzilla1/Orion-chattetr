const api = window.orion;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let settings = {
  model: "grok-4",
  userName: "",
  persona: "",
  personaFolder: "",
  hasApiKey: false,
};
let chatHistory = []; // { role: "user" | "assistant", content: string }

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const resetChatBtn = document.getElementById("resetChatBtn");
const attachMediaBtn = document.getElementById("attachMediaBtn");
const attachPreview = document.getElementById("attachPreview");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

// Settings
const userNameInput = document.getElementById("userNameInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const apiKeyHint = document.getElementById("apiKeyHint");
const modelInput = document.getElementById("modelInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const saveStatus = document.getElementById("saveStatus");
const supabaseUrlInput = document.getElementById("supabaseUrlInput");
const supabaseKeyInput = document.getElementById("supabaseKeyInput");
const supabaseHint = document.getElementById("supabaseHint");
const siteUrlInput = document.getElementById("siteUrlInput");

// Persona
const personaInput = document.getElementById("personaInput");
const savePersonaBtn = document.getElementById("savePersonaBtn");
const clearPersonaBtn = document.getElementById("clearPersonaBtn");
const personaStatus = document.getElementById("personaStatus");
const dropzone = document.getElementById("dropzone");
const browseFilesBtn = document.getElementById("browseFilesBtn");
const folderPicked = document.getElementById("folderPicked");
const folderPathLabel = document.getElementById("folderPathLabel");
const folderCountLabel = document.getElementById("folderCountLabel");
const clearFolderBtn = document.getElementById("clearFolderBtn");
const generatePersonaBtn = document.getElementById("generatePersonaBtn");
const genStatus = document.getElementById("genStatus");

const subInfoList = document.getElementById("subInfoList");
const subInfoStatus = document.getElementById("subInfoStatus");
const subInfoSubtitle = document.getElementById("subInfoSubtitle");
const clearJournalBtn = document.getElementById("clearJournalBtn");
let journalEntries = [];
let journalWriteQueue = Promise.resolve();
let journalGeneration = 0;
// Which journal the sidebar is showing ("default" or "inbox:<chatId>").
let journalContext = "default";

// Selected reference folder for persona generation.
let personaFolder = "";
let personaFolderFileCount = 0;

// Inbox state
let inboxChats = [];
let inboxSelectedId = null;
let inboxLoaded = false;

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    navItems.forEach((b) => b.classList.toggle("active", b === btn));
    views.forEach((v) =>
      v.classList.toggle("active", v.id === `view-${view}`)
    );
    if (view === "chat") {
      setJournalContext("default");
      if (subInfoSubtitle) {
        subInfoSubtitle.textContent =
          "Her journal — every little detail he drops";
      }
      api.memory
        .get("default")
        .then((memory) =>
          syncMemoryToSubInfo(memory, { animate: false, context: "default" })
        )
        .catch(() => initSubInfoUi());
      chatInput.focus();
    }
    if (view === "inbox") {
      loadInbox({ quiet: inboxLoaded });
    }
  });
});

function setJournalContext(key) {
  journalContext = key || "default";
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------
function refreshStatus() {
  if (settings.hasApiKey) {
    statusDot.className = "status-dot online";
    statusText.textContent = "Orion is online";
  } else {
    statusDot.className = "status-dot offline";
    statusText.textContent = "API key needed";
  }
}

// ---------------------------------------------------------------------------
// Sub Info journal — a blank page the AI writes on, entry by entry
// ---------------------------------------------------------------------------
function initSubInfoUi(hintText = "Nothing written yet.") {
  if (!subInfoList) return;
  subInfoList.innerHTML = "";
  journalEntries = [];
  journalGeneration++;
  const hint = document.createElement("div");
  hint.className = "journal-empty";
  hint.textContent = hintText;
  subInfoList.appendChild(hint);
  setSubInfoStatus("Waiting for details…", true);
}

function setSubInfoStatus(text, idle = false) {
  if (!subInfoStatus) return;
  subInfoStatus.textContent = text;
  subInfoStatus.classList.toggle("idle", idle);
}

function removeJournalEmptyHint() {
  const hint = subInfoList?.querySelector(".journal-empty");
  if (hint) hint.remove();
}

function normalizeJournalEntryLocal(raw) {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? { text, at: null } : null;
  }
  if (raw && typeof raw === "object") {
    const text = String(raw.text || "").trim();
    if (!text) return null;
    return { text, at: raw.at || null };
  }
  return null;
}

function journalStampLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function createJournalLine(entry) {
  removeJournalEmptyHint();
  const line = document.createElement("div");
  line.className = "journal-entry";
  const stamp = journalStampLocal(entry.at);
  if (stamp) {
    const time = document.createElement("div");
    time.className = "journal-time";
    time.textContent = stamp;
    line.appendChild(time);
  }
  const textEl = document.createElement("div");
  textEl.className = "journal-text";
  line.appendChild(textEl);
  subInfoList.appendChild(line);
  return { line, textEl };
}

function appendJournalEntryInstant(entry) {
  const { textEl } = createJournalLine(entry);
  textEl.textContent = entry.text;
}

function typeJournalEntry(entry) {
  const { line, textEl } = createJournalLine(entry);
  line.classList.add("writing");
  const text = entry.text;

  const caret = document.createElement("span");
  caret.className = "caret";
  caret.textContent = " ";
  textEl.appendChild(caret);
  subInfoList.scrollTop = subInfoList.scrollHeight;

  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      if (i >= text.length) {
        textEl.textContent = text;
        line.classList.remove("writing");
        subInfoList.scrollTop = subInfoList.scrollHeight;
        resolve();
        return;
      }
      i = Math.min(text.length, i + (text.length > 90 ? 3 : 2));
      textEl.textContent = text.slice(0, i);
      textEl.appendChild(caret);
      subInfoList.scrollTop = subInfoList.scrollHeight;
      setTimeout(step, 14 + Math.random() * 26);
    };
    step();
  });
}

function applyJournalUpdate(nextEntries, { animate = true } = {}) {
  const next = Array.isArray(nextEntries)
    ? nextEntries.map(normalizeJournalEntryLocal).filter(Boolean)
    : [];
  const known = new Set(journalEntries.map((e) => e.text.toLowerCase()));
  const fresh = next.filter((e) => !known.has(e.text.toLowerCase()));
  journalEntries = journalEntries.concat(fresh);

  if (!fresh.length) {
    setSubInfoStatus(
      journalEntries.length ? "Journal up to date" : "Waiting for details…",
      true
    );
    return journalWriteQueue;
  }

  // Queue writes so overlapping updates never interleave entries.
  const gen = journalGeneration;
  journalWriteQueue = journalWriteQueue.then(async () => {
    if (gen !== journalGeneration) return; // journal was reset meanwhile
    setSubInfoStatus("Writing him down…", false);
    for (const entry of fresh) {
      if (gen !== journalGeneration) return;
      if (animate) await typeJournalEntry(entry);
      else appendJournalEntryInstant(entry);
    }
    setSubInfoStatus("Journal up to date", true);
  });
  return journalWriteQueue;
}

async function syncMemoryToSubInfo(
  memory,
  { animate = true, context = "default" } = {}
) {
  if (!memory) return;
  // Journals persist in Supabase (via the main process) — nothing to mirror locally.
  // Only paint the sidebar if it is currently showing this journal.
  if (context !== journalContext) return;
  await applyJournalUpdate(memory.journal || [], { animate });
}

if (clearJournalBtn) {
  clearJournalBtn.addEventListener("click", async () => {
    try {
      await api.memory.clear(journalContext);
    } catch {
      // ignore
    }
    initSubInfoUi();
  });
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
function renderChatEmpty() {
  const name = settings.userName ? settings.userName : "there";
  chatWindow.innerHTML = `
    <div class="chat-empty">
      <div class="empty-orb"></div>
      <h2>Hey ${escapeHtml(name)} 👋</h2>
      <p class="muted">
        I'm Orion. I'd love to get to know you — tell me about your day, or ask
        me about any of your videos.
      </p>
    </div>`;
}

function addMessage(role, content) {
  const empty = chatWindow.querySelector(".chat-empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "user" : "bot"}`;
  div.textContent = content;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function addMediaMessage(role, { kind, previewUrl, caption }) {
  const empty = chatWindow.querySelector(".chat-empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = `msg media-msg ${role === "user" ? "user" : "bot"}`;

  if (kind === "video") {
    const vid = document.createElement("video");
    vid.className = "msg-media";
    vid.src = previewUrl;
    vid.controls = true;
    vid.playsInline = true;
    div.appendChild(vid);
  } else {
    const img = document.createElement("img");
    img.className = "msg-media";
    img.src = previewUrl;
    img.alt = "Attachment";
    div.appendChild(img);
  }

  if (caption) {
    const cap = document.createElement("div");
    cap.className = "msg-media-caption";
    cap.textContent = caption;
    div.appendChild(cap);
  }

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

// Pending attachments before send: { id, kind, path, name, previewUrl, objectUrl }
let pendingAttachments = [];

function isVideoPath(p) {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(p || "");
}

function isImagePath(p) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(p || "");
}

function clearPendingAttachments() {
  for (const a of pendingAttachments) {
    if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
  }
  pendingAttachments = [];
  renderAttachPreview();
}

function renderAttachPreview() {
  attachPreview.innerHTML = "";
  if (!pendingAttachments.length) {
    attachPreview.hidden = true;
    return;
  }
  attachPreview.hidden = false;
  for (const a of pendingAttachments) {
    const chip = document.createElement("div");
    chip.className = "attach-chip";
    if (a.kind === "video") {
      const v = document.createElement("video");
      v.src = a.previewUrl;
      v.muted = true;
      chip.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = a.previewUrl;
      img.alt = a.name;
      chip.appendChild(img);
    }
    const label = document.createElement("div");
    label.className = "chip-label";
    label.textContent = a.kind === "video" ? "video" : "photo";
    chip.appendChild(label);
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "chip-remove";
    rm.textContent = "✕";
    rm.addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((x) => x.id !== a.id);
      if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      renderAttachPreview();
    });
    chip.appendChild(rm);
    attachPreview.appendChild(chip);
  }
}

async function addAttachmentFromPath(filePath) {
  if (!filePath) return;
  if (pendingAttachments.some((a) => a.path === filePath)) return;
  const kind = isVideoPath(filePath)
    ? "video"
    : isImagePath(filePath)
      ? "image"
      : null;
  if (!kind) return;

  const previewUrl = await api.videos.mediaUrl(filePath);
  const name = filePath.split(/[\\/]/).pop();
  pendingAttachments.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    path: filePath,
    name,
    previewUrl,
  });
  renderAttachPreview();
}

async function fileToJpegDataUrl(filePath, maxSide = 1280, quality = 0.72) {
  const url = await api.videos.mediaUrl(filePath);
  const img = new Image();
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Couldn't load image"));
  });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function waitForEvent(el, event) {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`Video ${event} failed`));
    };
    const cleanup = () => {
      el.removeEventListener(event, onOk);
      el.removeEventListener("error", onErr);
    };
    el.addEventListener(event, onOk, { once: true });
    el.addEventListener("error", onErr, { once: true });
  });
}

async function extractVideoFrames(filePath, count = 5) {
  const url = await api.videos.mediaUrl(filePath);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  document.body.appendChild(video);
  video.style.position = "fixed";
  video.style.left = "-9999px";

  try {
    await waitForEvent(video, "loadedmetadata");
    const duration = Math.max(0.1, video.duration || 1);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const frames = [];
    for (let i = 1; i <= count; i++) {
      const t = (duration * i) / (count + 1);
      video.currentTime = Math.min(duration - 0.05, Math.max(0, t));
      await waitForEvent(video, "seeked");
      const maxSide = 960;
      const scale = Math.min(
        1,
        maxSide / Math.max(video.videoWidth || 640, video.videoHeight || 360)
      );
      canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    return frames;
  } finally {
    video.remove();
  }
}

async function analyzeAttachment(att) {
  if (att.kind === "video") {
    const frames = await extractVideoFrames(att.path, 5);
    return api.chat.analyzeMedia({
      kind: "video",
      imageDataUrls: frames,
      fileName: att.name,
      filePath: att.path,
    });
  }
  const dataUrl = await fileToJpegDataUrl(att.path);
  return api.chat.analyzeMedia({
    kind: "image",
    imageDataUrls: [dataUrl],
    fileName: att.name,
    filePath: att.path,
  });
}

function buildMediaUserContent({ kind, description, caption }) {
  const lines = [
    kind === "video"
      ? "[I just sent you a video to watch]"
      : "[I just sent you a photo to look at]",
    "",
    "What you can see (treat this as what you personally watched/saw):",
    description,
  ];
  if (caption) {
    lines.push("", "What I said with it:", caption);
  }
  return lines.join("\n");
}

function showTypingIndicator() {
  const empty = chatWindow.querySelector(".chat-empty");
  if (empty) empty.remove();

  // Only one typing bubble at a time.
  hideTypingIndicator();

  const div = document.createElement("div");
  div.className = "msg bot typing";
  div.id = "orionTyping";
  div.setAttribute("aria-label", "Orion is typing");
  div.innerHTML =
    '<span class="typing-dots"><span></span><span></span><span></span></span>';
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function hideTypingIndicator() {
  const el = document.getElementById("orionTyping");
  if (el) el.remove();
}

function typingDelayForBubble(text) {
  // Feels like reading the last message + typing the next one.
  const base = randBetween(900, 1600);
  const byLen = Math.min(String(text || "").length * 28, 2200);
  return base + byLen + randBetween(0, 500);
}

function setSending(sending) {
  sendBtn.disabled = sending;
  // Keep the input enabled so they can keep typing / queue more messages.
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const randBetween = (min, max) => min + Math.random() * (max - min);

// Break one line into separate thoughts: greeting / statement / questions.
function splitThoughts(part) {
  let rest = String(part || "").trim();
  if (!rest) return [];
  const out = [];

  // Peel a leading greeting: "hii baby, hows ur day going?" -> "hii baby" + rest
  const greet = rest.match(
    /^((?:h+e+y+|h+i+|yo+|omg+|aww+|hah+a*|lol+|heyy+|hii+)[a-z]*(?:\s+(?:baby|babe|bb|cutie|handsome|love|u|there|stranger))?)\s*[,.!~-]+\s+(.+)$/i
  );
  if (greet) {
    out.push(greet[1].trim());
    rest = greet[2].trim();
  }

  // Split after every "?" or "!" that has more text following it.
  const segs = rest
    .split(/(?<=[?!])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segs) {
    // Peel a trailing question jammed onto a statement without punctuation.
    const qSplit = seg.match(
      /^(.+?[a-z)\].…"'])\s+((?:whatchu|watchu|what|hows?|why|where|when|who|do u|are u|r u|u wanna|u ever|wanna|got any|tell me|be honest)\b[^?]*\s[^?]*\?)\s*$/i
    );
    if (qSplit && qSplit[1].trim().length > 2 && !qSplit[1].includes("?")) {
      out.push(qSplit[1].trim());
      out.push(qSplit[2].trim());
    } else {
      out.push(seg);
    }
  }
  return out;
}

// Split Orion's reply into separate text bubbles, like a real person texting.
function splitBubbles(text) {
  const raw = String(text || "").trim();
  if (!raw) return [""];

  // Explicit separators and line breaks first, then split each line into
  // individual thoughts — never keep greeting + questions as one bubble.
  const parts = raw
    .split(/\|\|\|/)
    .flatMap((chunk) => chunk.split(/\n+/))
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(splitThoughts)
    .filter(Boolean);

  return parts.length ? parts : [raw];
}

// Wait after the user sends to see if they're still typing / sending more,
// then pause like she's reading + typing before the reply appears.
const REPLY_QUIET_MS = 10000;
let replyQuietTimer = null;
let isOrionResponding = false;

function lastChatRole() {
  if (!chatHistory.length) return null;
  return chatHistory[chatHistory.length - 1].role;
}

function hasUnrepliedUserMessage() {
  return lastChatRole() === "user";
}

function armReplyQuietTimer() {
  if (replyQuietTimer) clearTimeout(replyQuietTimer);
  replyQuietTimer = setTimeout(() => {
    replyQuietTimer = null;
    flushOrionReply();
  }, REPLY_QUIET_MS);
}

async function flushOrionReply() {
  if (isOrionResponding) {
    if (hasUnrepliedUserMessage()) armReplyQuietTimer();
    return;
  }
  if (!hasUnrepliedUserMessage()) return;

  isOrionResponding = true;
  setSending(true);
  setSubInfoStatus("Listening for new details…", false);

  // She's reading what he wrote…
  await delay(randBetween(2000, 4000));
  if (!hasUnrepliedUserMessage()) {
    isOrionResponding = false;
    setSending(false);
    return;
  }

  showTypingIndicator();

  // …then taking a moment to type
  await delay(randBetween(1500, 3500));

  const res = await api.chat.send({ messages: chatHistory });

  if (res.error) {
    hideTypingIndicator();
    isOrionResponding = false;
    setSending(false);
    const err = addMessage("bot", `⚠️ ${res.error}`);
    err.style.borderColor = "var(--danger)";
    if (hasUnrepliedUserMessage()) armReplyQuietTimer();
    return;
  }

  const bubbles = splitBubbles(res.reply);

  for (let i = 0; i < bubbles.length; i++) {
    // Keep the typing dots visible while she "types" this bubble.
    showTypingIndicator();
    await delay(
      i === 0 ? randBetween(600, 1200) : typingDelayForBubble(bubbles[i])
    );
    hideTypingIndicator();
    addMessage("bot", bubbles[i]);

    // Small beat after a bubble lands before she starts typing the next one.
    if (i < bubbles.length - 1) {
      await delay(randBetween(350, 800));
    }
  }

  hideTypingIndicator();
  chatHistory.push({ role: "assistant", content: bubbles.join("\n") });
  if (res.memory) {
    syncMemoryToSubInfo(res.memory, { animate: true });
  }

  isOrionResponding = false;
  setSending(false);
  chatInput.focus();

  // If he kept sending while she was replying, wait again before the next reply.
  if (hasUnrepliedUserMessage()) armReplyQuietTimer();
}

function queueUserMessage(text) {
  addMessage("user", text);
  chatHistory.push({ role: "user", content: text });
  // Don't reply instantly — wait to see if he's still typing / sending more.
  if (!isOrionResponding) armReplyQuietTimer();
}

async function sendChatPayload() {
  let text = chatInput.value.trim();
  const attachments = pendingAttachments.slice();
  if (!text && !attachments.length) return;

  chatInput.value = "";
  chatInput.style.height = "auto";
  // Keep preview URLs alive for chat bubbles; don't revoke object URLs we still show.
  pendingAttachments = [];
  renderAttachPreview();

  if (!attachments.length) {
    queueUserMessage(text);
    return;
  }

  // Show media in the UI immediately, analyze with Grok, then queue text Orion can use.
  for (const att of attachments) {
    addMediaMessage("user", {
      kind: att.kind,
      previewUrl: att.previewUrl,
      caption: text || "",
    });
  }

  const watching = addMessage(
    "bot",
    attachments.some((a) => a.kind === "video")
      ? "watching ur video…"
      : "looking at ur photo…"
  );
  watching.classList.add("typing");

  try {
    const descriptions = [];
    for (const att of attachments) {
      const res = await analyzeAttachment(att);
      if (res.error) throw new Error(res.error);
      descriptions.push({
        kind: att.kind,
        name: att.name,
        description: res.description,
      });
    }
    watching.remove();

    let captionUsed = false;
    for (const d of descriptions) {
      const content = buildMediaUserContent({
        kind: d.kind,
        description: d.description,
        caption: captionUsed ? "" : text,
      });
      captionUsed = true;
      chatHistory.push({ role: "user", content });
    }

    if (!isOrionResponding) armReplyQuietTimer();
  } catch (err) {
    watching.remove();
    const errMsg = addMessage(
      "bot",
      `⚠️ Couldn't watch that media: ${err.message || err}`
    );
    errMsg.style.borderColor = "var(--danger)";
    if (text) queueUserMessage(text);
  }
}

attachMediaBtn.addEventListener("click", async () => {
  const paths = await api.chat.pickMedia();
  for (const p of paths || []) {
    await addAttachmentFromPath(p);
  }
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendChatPayload();
});

// Enter to send, Shift+Enter for newline. Auto-grow textarea.
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
  // Still composing in the box after sending? Keep waiting.
  if (hasUnrepliedUserMessage() && !isOrionResponding) {
    armReplyQuietTimer();
  }
});

// Allow dropping media onto the chat window.
chatWindow.addEventListener("dragover", (e) => {
  e.preventDefault();
});
chatWindow.addEventListener("drop", async (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  for (const file of files) {
    const p = api.persona.getFilePath(file);
    if (p) await addAttachmentFromPath(p);
  }
});

async function resetChat() {
  const ok = window.confirm(
    "Reset chat? This clears the conversation and everything Orion remembered about you."
  );
  if (!ok) return;

  if (replyQuietTimer) {
    clearTimeout(replyQuietTimer);
    replyQuietTimer = null;
  }
  isOrionResponding = false;
  setSending(false);

  chatHistory = [];
  chatInput.value = "";
  chatInput.style.height = "auto";
  hideTypingIndicator();
  clearPendingAttachments();

  try {
    await api.memory.clear();
  } catch {
    // ignore
  }
  initSubInfoUi();

  renderChatEmpty();
  chatInput.focus();
}

resetChatBtn.addEventListener("click", () => {
  resetChat();
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function loadSettings() {
  settings = await api.settings.get();

  userNameInput.value = settings.userName || "";
  personaInput.value = settings.persona || "";
  modelInput.value = settings.model || "grok-4";
  apiKeyHint.textContent = settings.hasApiKey
    ? "A key is saved. Leave blank to keep it, or type a new one to replace."
    : "No key saved yet.";

  supabaseUrlInput.value = settings.supabaseUrl || "";
  updateSupabaseHint();
  if (siteUrlInput) siteUrlInput.value = settings.siteUrl || "";

  if (settings.personaFolder) {
    await setPersonaFolder(settings.personaFolder, { persist: false });
  }

  // Paint the default journal from wherever it lives (Supabase or local file).
  try {
    const memory = await api.memory.get();
    await syncMemoryToSubInfo(memory, { animate: false });
  } catch {
    // ignore memory sync errors
  }

  refreshStatus();
  renderChatEmpty();
}

function updateSupabaseHint() {
  if (!supabaseHint) return;
  if (settings.supabaseReady) {
    supabaseHint.textContent =
      "Connected ✓ — Inbox chats and journals are stored in Supabase.";
  } else if (settings.supabaseUrl || settings.hasSupabaseKey) {
    supabaseHint.textContent =
      "Add both the project URL and a key to connect. Run supabase-schema.sql in your project first.";
  } else {
    supabaseHint.textContent =
      "Stores Inbox chats and Mind Reader journals in the cloud. Run supabase-schema.sql in your project first.";
  }
}

saveSettingsBtn.addEventListener("click", async () => {
  const payload = {
    userName: userNameInput.value,
    model: modelInput.value,
    supabaseUrl: supabaseUrlInput.value.trim(),
    siteUrl: siteUrlInput ? siteUrlInput.value.trim() : undefined,
  };
  const typedKey = apiKeyInput.value.trim();
  if (typedKey) payload.apiKey = typedKey;
  const typedSbKey = supabaseKeyInput.value.trim();
  if (typedSbKey) payload.supabaseKey = typedSbKey;

  settings = await api.settings.set(payload);

  apiKeyInput.value = "";
  apiKeyHint.textContent = settings.hasApiKey
    ? "A key is saved. Leave blank to keep it, or type a new one to replace."
    : "No key saved yet.";
  supabaseKeyInput.value = "";
  updateSupabaseHint();

  saveStatus.textContent = "Saved ✓";
  setTimeout(() => (saveStatus.textContent = ""), 2500);
  refreshStatus();
  renderChatEmpty();
});

// ---------------------------------------------------------------------------
// Persona
// ---------------------------------------------------------------------------
function flashPersonaStatus(text) {
  personaStatus.textContent = text;
  setTimeout(() => (personaStatus.textContent = ""), 2500);
}

// Persona + folder path persist in settings.json via api.settings.set, so
// there's nothing to mirror in the browser anymore. Kept as a no-op so the
// existing call sites don't need to change.
function persistPersonaLocally() {}

function renderFolderPicked() {
  if (!personaFolder) {
    folderPicked.hidden = true;
    folderPathLabel.textContent = "";
    folderCountLabel.textContent = "";
    generatePersonaBtn.disabled = true;
    return;
  }
  folderPicked.hidden = false;
  folderPathLabel.textContent = personaFolder;
  folderCountLabel.textContent =
    personaFolderFileCount > 0
      ? `${personaFolderFileCount} document(s) found`
      : "No supported documents found yet";
  generatePersonaBtn.disabled = personaFolderFileCount === 0;
}

async function setPersonaFolder(folderPath, { persist = true, fileCount } = {}) {
  personaFolder = folderPath || "";
  if (!personaFolder) {
    personaFolderFileCount = 0;
    renderFolderPicked();
    if (persist) {
      persistPersonaLocally(undefined, "");
      settings = await api.settings.set({ personaFolder: "" });
    }
    return;
  }

  if (typeof fileCount === "number") {
    personaFolderFileCount = fileCount;
  } else {
    const info = await api.persona.inspectFolder(personaFolder);
    if (info.error) {
      personaFolderFileCount = 0;
      genStatus.textContent = `⚠️ ${info.error}`;
    } else {
      personaFolderFileCount = info.fileCount || 0;
    }
  }

  renderFolderPicked();

  if (persist) {
    persistPersonaLocally(undefined, personaFolder);
    settings = await api.settings.set({ personaFolder });
  }
}

savePersonaBtn.addEventListener("click", async () => {
  const persona = personaInput.value;
  settings = await api.settings.set({ persona });
  persistPersonaLocally(persona, personaFolder);
  flashPersonaStatus(
    settings.persona.trim()
      ? "Persona saved ✓ Orion will embody it from your next message."
      : "Persona cleared ✓ Orion is back to its default personality."
  );
});

clearPersonaBtn.addEventListener("click", async () => {
  personaInput.value = "";
  settings = await api.settings.set({ persona: "" });
  persistPersonaLocally("", undefined);
  flashPersonaStatus("Persona cleared ✓ Orion is back to its default personality.");
});

clearFolderBtn.addEventListener("click", async () => {
  await setPersonaFolder("");
  genStatus.textContent = "";
});

async function chooseFolder() {
  const res = await api.persona.pickFolder();
  if (!res || !res.folderPath) return;
  await setPersonaFolder(res.folderPath, { fileCount: res.fileCount });
  genStatus.textContent =
    res.fileCount > 0
      ? `Folder ready — ${res.fileCount} document(s).`
      : "Folder selected, but no supported documents were found.";
}

dropzone.addEventListener("click", () => {
  chooseFolder();
});
browseFilesBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  chooseFolder();
});

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "dragend"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  const p = api.persona.getFilePath(file);
  if (!p) return;
  const folderGuess = file.type ? p.replace(/[\\/][^\\/]+$/, "") : p;
  const info = await api.persona.inspectFolder(folderGuess);
  if (info.error) {
    genStatus.textContent = `⚠️ Drop a folder (or pick one with Browse). ${info.error}`;
    return;
  }
  await setPersonaFolder(info.folderPath, { fileCount: info.fileCount });
  genStatus.textContent =
    info.fileCount > 0
      ? `Folder ready — ${info.fileCount} document(s).`
      : "Folder selected, but no supported documents were found.";
});

generatePersonaBtn.addEventListener("click", async () => {
  if (!personaFolder) return;
  generatePersonaBtn.disabled = true;
  genStatus.textContent = `Analyzing folder (${personaFolderFileCount} file(s)) with Grok…`;

  const res = await api.persona.generate(personaFolder);

  generatePersonaBtn.disabled = personaFolderFileCount === 0;

  if (res.error) {
    genStatus.textContent = `⚠️ ${res.error}`;
    return;
  }

  personaInput.value = res.persona;
  persistPersonaLocally(res.persona, res.folderPath || personaFolder);
  settings.persona = res.persona;
  if (res.folderPath) settings.personaFolder = res.folderPath;

  let msg = `Persona drafted from ${res.used} file(s) and saved locally.`;
  if (res.skipped && res.skipped.length) {
    msg += ` Skipped: ${res.skipped.join("; ")}`;
  }
  genStatus.textContent = msg;
  flashPersonaStatus("Persona saved ✓ Ready for chat.");
});

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avatarColor(seed) {
  const colors = [
    "#7a5cff",
    "#e05a9c",
    "#3d9b8f",
    "#d4a017",
    "#5b8def",
    "#c45c5c",
  ];
  let h = 0;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

// ---------------------------------------------------------------------------
// Inbox — platform chats (analyze / send / sync), no OnlyFans
// ---------------------------------------------------------------------------
const inboxChatList = document.getElementById("inboxChatList");
const inboxStatus = document.getElementById("inboxStatus");
const inboxEmpty = document.getElementById("inboxEmpty");
const inboxDetail = document.getElementById("inboxDetail");
const inboxDetailName = document.getElementById("inboxDetailName");
const inboxDetailUser = document.getElementById("inboxDetailUser");
const inboxTranscript = document.getElementById("inboxTranscript");
const inboxLinkBtn = document.getElementById("inboxLinkBtn");
const inboxAnalyzeBtn = document.getElementById("inboxAnalyzeBtn");
const inboxSuggestionBox = document.getElementById("inboxSuggestionBox");
const inboxSuggestionText = document.getElementById("inboxSuggestionText");
const inboxSendBtn = document.getElementById("inboxSendBtn");
const inboxRegenerateBtn = document.getElementById("inboxRegenerateBtn");
const inboxSyncBtn = document.getElementById("inboxSyncBtn");
const inboxNewBtn = document.getElementById("inboxNewBtn");
const inboxFanForm = document.getElementById("inboxFanForm");
const inboxFanInput = document.getElementById("inboxFanInput");

function setInboxStatus(text) {
  if (inboxStatus) inboxStatus.textContent = text || "";
}

function selectedInboxChat() {
  return inboxChats.find((c) => c.id === inboxSelectedId) || null;
}

function renderInboxChatList() {
  if (!inboxChatList) return;
  inboxChatList.innerHTML = "";
  if (!inboxChats.length) {
    const empty = document.createElement("p");
    empty.className = "muted small";
    empty.style.padding = "8px";
    empty.textContent = "No chats yet. Click New chat.";
    inboxChatList.appendChild(empty);
    return;
  }
  for (const chat of inboxChats) {
    const btn = document.createElement("button");
    btn.className = "inbox-chat-item";
    if (chat.id === inboxSelectedId) btn.classList.add("active");

    const av = document.createElement("div");
    av.className = "inbox-chat-avatar";
    av.style.background = avatarColor(chat.id || chat.name);
    av.textContent = String(chat.name || "?").trim().charAt(0).toUpperCase() || "?";
    if (chat.avatar) {
      const img = document.createElement("img");
      img.src = chat.avatar;
      img.alt = "";
      img.onerror = () => img.remove();
      av.appendChild(img);
    }
    btn.appendChild(av);

    const meta = document.createElement("div");
    meta.className = "inbox-chat-meta";
    const name = document.createElement("div");
    name.className = "inbox-chat-name";
    name.textContent = chat.name || "Unknown";
    meta.appendChild(name);
    if (chat.username) {
      const user = document.createElement("div");
      user.className = "inbox-chat-username";
      user.textContent = chat.username.startsWith("@")
        ? chat.username
        : `@${chat.username}`;
      meta.appendChild(user);
    }
    if (chat.lastMessage) {
      const last = document.createElement("div");
      last.className = "inbox-chat-last";
      last.textContent = chat.lastMessage;
      meta.appendChild(last);
    }
    btn.appendChild(meta);

    if (chat.unread > 0) {
      const badge = document.createElement("span");
      badge.className = "inbox-chat-unread";
      badge.textContent = String(chat.unread);
      btn.appendChild(badge);
    }

    btn.addEventListener("click", () => selectInboxChat(chat.id));
    inboxChatList.appendChild(btn);
  }
}

function renderInboxTranscript(chat) {
  if (!inboxTranscript) return;
  inboxTranscript.innerHTML = "";
  for (const m of chat.messages || []) {
    const bubble = document.createElement("div");
    bubble.className = `inbox-msg ${m.role === "me" ? "me" : "fan"}`;
    if (m.media?.url) {
      const media =
        m.media.kind === "video"
          ? document.createElement("video")
          : document.createElement("img");
      media.src = m.media.url;
      if (m.media.kind === "video") media.controls = true;
      media.className = "inbox-msg-media";
      bubble.appendChild(media);
    }
    if (m.content) {
      const text = document.createElement("div");
      text.textContent = m.content;
      bubble.appendChild(text);
    }
    inboxTranscript.appendChild(bubble);
  }
  inboxTranscript.scrollTop = inboxTranscript.scrollHeight;
}

function showInboxSuggestion(text) {
  if (!inboxSuggestionBox) return;
  if (!text) {
    inboxSuggestionBox.hidden = true;
    inboxSuggestionText.textContent = "";
    return;
  }
  inboxSuggestionText.textContent = text;
  inboxSuggestionBox.hidden = false;
}

async function selectInboxChat(chatId) {
  inboxSelectedId = chatId;
  renderInboxChatList();

  const memoryKey = `inbox:${chatId}`;
  setJournalContext(memoryKey);
  initSubInfoUi("Loading journal…");
  if (subInfoSubtitle) {
    const c = selectedInboxChat();
    subInfoSubtitle.textContent = c
      ? `Her journal on ${c.name}`
      : "Each chat has its own journal";
  }

  let chat = selectedInboxChat();
  const res = await api.inbox.get({ chatId });
  if (res.error) {
    setInboxStatus(`⚠️ ${res.error}`);
    return;
  }
  if (res.found && res.chat) {
    chat = res.chat;
    const idx = inboxChats.findIndex((c) => c.id === chatId);
    if (idx >= 0) inboxChats[idx] = chat;
    else inboxChats.unshift(chat);
  }
  if (!chat) return;

  inboxEmpty.hidden = true;
  inboxDetail.hidden = false;
  inboxDetailName.textContent = chat.name || "Unknown";
  inboxDetailUser.textContent = chat.username
    ? chat.username.startsWith("@")
      ? chat.username
      : `@${chat.username}`
    : "";
  renderInboxTranscript(chat);
  showInboxSuggestion(chat.suggestion || "");

  try {
    await api.inbox.markRead({ chatId });
    chat.unread = 0;
    renderInboxChatList();
  } catch {
    // ignore
  }

  try {
    const memory = await api.memory.get(memoryKey);
    await syncMemoryToSubInfo(memory, { animate: false, context: memoryKey });
    setSubInfoStatus(
      (memory.journal || []).length ? "Journal up to date" : "Waiting for details…",
      true
    );
  } catch {
    initSubInfoUi("Nothing written yet.");
  }
}

async function loadInbox({ quiet = false } = {}) {
  if (!quiet) setInboxStatus("Loading chats…");
  const res = await api.inbox.list();
  if (res.error) {
    setInboxStatus(`⚠️ ${res.error}`);
    return;
  }
  inboxChats = res.chats || [];
  inboxLoaded = true;
  renderInboxChatList();
  setInboxStatus(
    quiet
      ? ""
      : res.supabase
        ? `${inboxChats.length} chat(s) · synced with Supabase`
        : `${inboxChats.length} chat(s) · stored locally`
  );
  if (inboxSelectedId) {
    const still = inboxChats.find((c) => c.id === inboxSelectedId);
    if (still) await selectInboxChat(inboxSelectedId);
  }
}

async function syncInbox() {
  setInboxStatus("Syncing…");
  const res = await api.inbox.sync();
  if (res.error) {
    setInboxStatus(`⚠️ ${res.error}`);
    return;
  }
  inboxChats = res.chats || [];
  renderInboxChatList();
  setInboxStatus(
    `Synced ✓ — ${inboxChats.length} chat(s)${
      res.supabase ? " from Supabase" : " from local store"
    }`
  );
  if (inboxSelectedId) await selectInboxChat(inboxSelectedId);
}

function chatShareLink(chatId) {
  const base = (settings.siteUrl || "").replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/c/${chatId}`;
}

async function copyChatLink(chatId, { silentIfMissing = false } = {}) {
  const link = chatShareLink(chatId);
  if (!link) {
    if (!silentIfMissing) {
      setInboxStatus(
        "⚠️ Set the Chat page URL in Settings first (your Vercel deployment)."
      );
    }
    return "";
  }
  try {
    await navigator.clipboard.writeText(link);
    setInboxStatus(`Link copied ✓ — ${link}`);
  } catch {
    setInboxStatus(link);
  }
  return link;
}

async function createInboxChat() {
  const name = window.prompt("Fan / contact name?");
  if (!name || !name.trim()) return;
  const username = window.prompt("Username (optional)?") || "";
  setInboxStatus("Creating chat…");
  const res = await api.inbox.create({
    name: name.trim(),
    username: username.trim(),
  });
  if (res.error) {
    setInboxStatus(`⚠️ ${res.error}`);
    return;
  }
  inboxChats.unshift(res.chat);
  renderInboxChatList();
  await selectInboxChat(res.chat.id);
  const link = await copyChatLink(res.chat.id, { silentIfMissing: true });
  if (link) {
    window.prompt("Chat created! Share this link (copied to clipboard):", link);
  } else {
    setInboxStatus(
      "Chat created. Set the Chat page URL in Settings to get a share link."
    );
  }
}

async function analyzeInboxChat() {
  const chat = selectedInboxChat();
  if (!chat) return;
  inboxAnalyzeBtn.disabled = true;
  inboxRegenerateBtn && (inboxRegenerateBtn.disabled = true);
  setInboxStatus("Analyzing…");
  setSubInfoStatus("Analyzing his chat…", false);
  try {
    const res = await api.inbox.analyze({ chatId: chat.id });
    if (res.error) throw new Error(res.error);
    const idx = inboxChats.findIndex((c) => c.id === chat.id);
    if (idx >= 0) inboxChats[idx] = res.chat;
    renderInboxChatList();
    renderInboxTranscript(res.chat);
    showInboxSuggestion(res.suggestion || "");
    if (res.memory) {
      await syncMemoryToSubInfo(res.memory, {
        animate: true,
        context: res.memoryKey || `inbox:${chat.id}`,
      });
      setSubInfoStatus("Journal up to date", true);
    }
    setInboxStatus("Analysis ready — review the next best reply.");
  } catch (err) {
    setInboxStatus(`⚠️ ${err.message}`);
    setSubInfoStatus("Analysis failed", true);
  } finally {
    inboxAnalyzeBtn.disabled = false;
    inboxRegenerateBtn && (inboxRegenerateBtn.disabled = false);
  }
}

async function sendInboxSuggestion() {
  const chat = selectedInboxChat();
  const text = (inboxSuggestionText?.textContent || "").trim();
  if (!chat || !text) return;
  inboxSendBtn.disabled = true;
  setInboxStatus("Sending…");
  try {
    const res = await api.inbox.send({ chatId: chat.id, text });
    if (res.error) throw new Error(res.error);
    const idx = inboxChats.findIndex((c) => c.id === chat.id);
    if (idx >= 0) inboxChats[idx] = res.chat;
    // Keep list sorted by latest activity.
    inboxChats.sort((a, b) =>
      String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || ""))
    );
    renderInboxChatList();
    renderInboxTranscript(res.chat);
    showInboxSuggestion("");
    setInboxStatus("Sent ✓");
  } catch (err) {
    setInboxStatus(`⚠️ ${err.message}`);
  } finally {
    inboxSendBtn.disabled = false;
  }
}

if (inboxSyncBtn) {
  inboxSyncBtn.addEventListener("click", () => syncInbox());
}
if (inboxNewBtn) {
  inboxNewBtn.addEventListener("click", () => createInboxChat());
}
if (inboxAnalyzeBtn) {
  inboxAnalyzeBtn.addEventListener("click", () => analyzeInboxChat());
}
if (inboxLinkBtn) {
  inboxLinkBtn.addEventListener("click", () => {
    if (inboxSelectedId) copyChatLink(inboxSelectedId);
  });
}
if (inboxRegenerateBtn) {
  inboxRegenerateBtn.addEventListener("click", () => analyzeInboxChat());
}
if (inboxSendBtn) {
  inboxSendBtn.addEventListener("click", () => sendInboxSuggestion());
}
if (inboxFanForm) {
  inboxFanForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chat = selectedInboxChat();
    const text = (inboxFanInput.value || "").trim();
    if (!chat || !text) return;
    inboxFanInput.value = "";
    const res = await api.inbox.addMessage({
      chatId: chat.id,
      role: "fan",
      content: text,
    });
    if (res.error) {
      setInboxStatus(`⚠️ ${res.error}`);
      return;
    }
    const idx = inboxChats.findIndex((c) => c.id === chat.id);
    if (idx >= 0) inboxChats[idx] = res.chat;
    inboxChats.sort((a, b) =>
      String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || ""))
    );
    renderInboxChatList();
    renderInboxTranscript(res.chat);
  });
}
if (api.inbox?.onSyncProgress) {
  api.inbox.onSyncProgress((data) => {
    if (data?.status === "synced") {
      setInboxStatus(`Synced ✓ — ${data.total || 0} chat(s)`);
    }
  });
}

// Auto-poll for new fan messages arriving from the web chat pages.
const INBOX_POLL_MS = 8000;
let inboxPolling = false;
setInterval(async () => {
  if (!inboxLoaded || inboxPolling) return;
  const inboxView = document.getElementById("view-inbox");
  if (!inboxView || !inboxView.classList.contains("active")) return;
  inboxPolling = true;
  try {
    const res = await api.inbox.list();
    if (res.error) return;
    const fresh = res.chats || [];
    const prevSelected = inboxChats.find((c) => c.id === inboxSelectedId);
    const nextSelected = fresh.find((c) => c.id === inboxSelectedId);
    // The list query has no messages/suggestion — keep the loaded copy of the
    // open chat so its transcript doesn't blank out between polls.
    inboxChats = fresh.map((c) =>
      c.id === inboxSelectedId && prevSelected
        ? {
            ...prevSelected,
            unread: c.unread,
            lastMessage: c.lastMessage,
            lastMessageAt: c.lastMessageAt,
          }
        : c
    );
    renderInboxChatList();
    if (
      nextSelected &&
      prevSelected &&
      String(nextSelected.lastMessageAt || "") !==
        String(prevSelected.lastMessageAt || "")
    ) {
      await selectInboxChat(inboxSelectedId);
    }
  } catch {
    // transient network errors — try again next tick
  } finally {
    inboxPolling = false;
  }
}, INBOX_POLL_MS);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async function init() {
  initSubInfoUi();
  await loadSettings();
  chatInput.focus();
})();
