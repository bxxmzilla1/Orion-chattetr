import { grokFetch, grokConfig } from "./grok.js";
import { formatJournalForPrompt, normalizeJournal } from "./journal.js";
import { loadMemory, saveMemory } from "./store.js";

// Ported from the Electron app's updateMemoryFromChat: after each exchange,
// Grok extracts new psychological journal entries about the fan.
export async function updateMemoryFromChat({
  userName,
  messages,
  reply,
  recentCount = 8,
  memoryKey,
}) {
  const memory = await loadMemory(memoryKey);
  const recent = (messages || []).slice(-recentCount);
  const lines = recent.map(
    (m) => `${m.role === "fan" ? userName || "user" : "Orion"}: ${m.content}`
  );
  if (reply) lines.push(`Orion: ${reply}`);
  const transcript = lines.join("\n");

  const extractPrompt = `You are a psychological profiler keeping a private, dated journal about the human user ("the sub") for a companion. Your job is to understand him on a deep level — mentally and sexually — not to log the chat. Every entry is an INSIGHT about who he is, how his mind works, or how he's doing right now.

Return ONLY valid JSON with this shape:
{
  "newEntries":["insight 1","insight 2"],
  "profile":"optional 2-4 sentence rolling psychological read of who he is"
}

What to write down:

1. PSYCHOLOGY & PERSONALITY (the core of the journal):
- How he reacts: to teasing, to flirting, to being ignored, to being complimented, to "no"
- What he likes / what excites him, what bores him, what makes him open up or shut down
- Triggers: what gets a strong reaction out of him (good or bad), what he responds to instantly
- Ego & insecurities: what he brags about, what he's defensive about, what he needs validated
- Communication style: direct or shy, patient or pushy, playful or serious, how fast he escalates
- Attachment signals: neediness, jealousy, how much attention he wants, how he handles waiting

2. MENTAL STATE RIGHT NOW (mood notes — these are timestamped, so track him through the day):
- Current mood, energy, stress level, loneliness, horniness, boredom
- What put him in that state if he says

3. SEXUAL PSYCHE:
- Kinks, fetishes, turn-ons, fantasies, what he escalates on, dominant/submissive lean, boldness, pace, what makes him invest

4. LIFE BASICS (important — keep a clear picture of his life):
- Job (and details like years, skill), hobbies, family, pets, relationship status, age, where he lives, schedule/routine

What NOT to write:
- Do NOT log chat events or quotes. Convert behavior into a read on him.
- No trivia that says nothing about him.

Rules:
- Resolve short answers against the question asked.
- Each entry is one short, complete sentence. Specific beats vague.
- Do NOT repeat or rephrase anything already in the journal below. Only genuinely NEW insights, corrections, or a NEW mood/state.
- Never invent. Never mention AI. Explicit sexual detail is allowed and should be captured plainly.
- Most turns produce 0-2 entries. If nothing new, return {"newEntries":[],"profile":""}

Journal so far (with date/time stamps):
${formatJournalForPrompt(memory.journal)}

Latest chat:
${transcript}`;

  try {
    const { model } = grokConfig();
    const apiRes = await grokFetch({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a sharp psychological profiler. You read people through how they text, not just what they say. Output only compact JSON. No markdown fences.",
        },
        { role: "user", content: extractPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1400,
      stream: false,
    });
    if (!apiRes.ok) return memory;
    const data = await apiRes.json();
    let raw = data.choices?.[0]?.message?.content?.trim() || "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return memory;
    }

    const now = new Date().toISOString();
    const incoming = normalizeJournal(parsed.newEntries).map((e) => ({
      text: e.text,
      at: e.at || now,
    }));
    const existing = normalizeJournal(memory.journal);
    const lower = new Set(existing.map((e) => e.text.toLowerCase()));
    const merged = existing.slice();
    for (const entry of incoming) {
      const key = entry.text.toLowerCase();
      if (lower.has(key)) continue;
      merged.push(entry);
      lower.add(key);
    }

    let profile = memory.profile || "";
    if (typeof parsed.profile === "string" && parsed.profile.trim()) {
      profile = parsed.profile.trim();
    }

    return await saveMemory(memoryKey, {
      journal: merged,
      profile,
      lastSceneCheckAt: memory.lastSceneCheckAt || null,
    });
  } catch {
    return memory;
  }
}
