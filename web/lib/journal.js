// Journal helpers — ported 1:1 from the Electron app so the web bot keeps the
// exact same memory behavior.

export function normalizeJournalEntry(raw) {
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

export function normalizeJournal(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeJournalEntry).filter(Boolean).slice(0, 500);
}

export function journalStamp(iso) {
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

export function formatJournalForPrompt(journal) {
  const entries = normalizeJournal(journal);
  return entries.length
    ? entries
        .map((e) => {
          const stamp = journalStamp(e.at);
          return `- ${stamp ? `[${stamp}] ` : ""}${e.text}`;
        })
        .join("\n")
    : "(Journal is empty.)";
}

export function formatMemoryForPrompt(memory) {
  if (!memory) return "(Nothing learned yet.)";
  const profile = (memory.profile || "").trim();
  const journal = normalizeJournal(memory.journal);
  const lines = [];
  if (profile) lines.push(`Profile summary:\n${profile}`);
  if (journal.length) {
    lines.push(
      `Journal about him (everything learned so far):\n${formatJournalForPrompt(
        journal
      )}`
    );
  }
  if (!lines.length) return "(Nothing learned yet.)";
  return lines.join("\n\n");
}

export function getSceneCheckGuidance(memory) {
  const last = memory?.lastSceneCheckAt
    ? Date.parse(memory.lastSceneCheckAt)
    : null;
  if (!last || Number.isNaN(last)) {
    return `Scene-check timing: You may ask ONCE early, softly, what he's up to / if he has privacy — then STOP fishing for alone time. Build rapport for about an hour before asking again.`;
  }
  const mins = Math.floor((Date.now() - last) / 60000);
  if (mins < 60) {
    return `Scene-check timing: Last alone/privacy check was ~${mins} min ago. DO NOT ask if he's alone, home, free, done, or tell him to text when free. Focus on rapport + getting to know him. Soft re-check allowed in ~${Math.max(
      1,
      60 - mins
    )} min.`;
  }
  return `Scene-check timing: ~${mins} min since last alone/privacy check. You may ask ONCE gently if he's alone / home with privacy now. If not, go straight back to rapport — no pushiness, no repeating.`;
}

export function looksLikeSceneCheck(text) {
  const t = String(text || "").toLowerCase();
  return /(alone|u home|you home|home or out|got privacy|by yourself|ur free|you free|almost free|almost done|text me when|when ur (home|done|free)|when you're (home|done|free)|free to talk|free rn)/i.test(
    t
  );
}
