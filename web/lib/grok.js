// Grok (x.ai) helpers for the web app, with the same resilient retry behavior
// as the Electron app.

const XAI_URL = "https://api.x.ai/v1/chat/completions";

export function grokConfig() {
  const apiKey = process.env.XAI_API_KEY;
  const model = process.env.XAI_MODEL || "grok-4";
  if (!apiKey) throw new Error("XAI_API_KEY is not set.");
  return { apiKey, model };
}

export async function grokFetch(body, { retries = 3, baseDelay = 900 } = {}) {
  const { apiKey } = grokConfig();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(XAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  if (lastErr) throw lastErr;
}

// Describe an image or video frames with Grok vision. `imageUrls` may be public
// https URLs (Supabase storage) or data URLs.
export async function describeMedia({ kind, imageUrls, fileName }) {
  const { model } = grokConfig();
  const frames = (imageUrls || []).filter(Boolean).slice(0, 6);
  if (!frames.length) return { error: "No media to analyze." };

  const content = frames.map((url) => ({
    type: "image_url",
    image_url: { url, detail: "high" },
  }));
  const label =
    kind === "video"
      ? `These are sequential frames from a video${
          fileName ? ` ("${fileName}")` : ""
        }. Describe the full video as if you watched it.`
      : `Describe this photo${fileName ? ` ("${fileName}")` : ""} in detail.`;
  content.push({
    type: "text",
    text: `${label}\n\nWrite a rich description the companion can use as "what I just saw" so she can react naturally and continue the chat.`,
  });

  const { MEDIA_DESCRIBE_SYSTEM } = await import("./prompt.js");
  const res = await grokFetch({
    model,
    messages: [
      { role: "system", content: MEDIA_DESCRIBE_SYSTEM },
      { role: "user", content },
    ],
    temperature: 0.4,
    max_tokens: 1000,
    stream: false,
  });
  if (!res.ok) {
    const text = await res.text();
    return { error: `Grok media error (${res.status}): ${text.slice(0, 300)}` };
  }
  const data = await res.json();
  const description = data.choices?.[0]?.message?.content?.trim();
  if (!description) return { error: "Empty description." };
  return { description };
}
