"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const MAX_FRAME_SIZE = 1024;

function resizeToDataUrl(source, width, height) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, MAX_FRAME_SIZE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function extractImageFrame(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = url;
    });
    return [resizeToDataUrl(img, img.naturalWidth, img.naturalHeight)];
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractVideoFrames(file, count = 6) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Could not read video"));
    });
    const duration = video.duration || 0;
    const frames = [];
    const n = duration > 2 ? count : Math.min(2, count);
    for (let i = 0; i < n; i++) {
      const t = duration > 0 ? (duration * (i + 0.5)) / n : 0;
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
      });
      frames.push(
        resizeToDataUrl(video, video.videoWidth || 640, video.videoHeight || 360)
      );
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ChatPage() {
  const { chatId } = useParams();
  const [chat, setChat] = useState(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null); // { file, kind, previewUrl }
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const textRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/chats/${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setChat(data.chat);
        setMessages(data.chat.messages || []);
      })
      .catch(() => alive && setError("Could not load this chat."));
    return () => {
      alive = false;
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = file.type.startsWith("video") ? "video" : "image";
    setAttachment({ file, kind, previewUrl: URL.createObjectURL(file) });
  }

  function clearAttachment() {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }

  async function uploadAttachment(file) {
    const res = await fetch(`/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, fileName: file.name }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const put = await fetch(data.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });
    if (!put.ok) throw new Error("Upload failed");
    return data.publicUrl;
  }

  async function send() {
    const content = text.trim();
    if ((!content && !attachment) || busy) return;
    setBusy(true);
    setError("");

    const localMedia = attachment
      ? { kind: attachment.kind, url: attachment.previewUrl }
      : null;
    setMessages((m) => [
      ...m,
      { role: "fan", content, at: new Date().toISOString(), media: localMedia },
    ]);
    setText("");
    const att = attachment;
    setAttachment(null);

    try {
      let media = null;
      let frames = [];
      if (att) {
        frames =
          att.kind === "video"
            ? await extractVideoFrames(att.file)
            : await extractImageFrame(att.file);
        const publicUrl = await uploadAttachment(att.file);
        media = { kind: att.kind, url: publicUrl, fileName: att.file.name };
        // Swap the local blob preview for the permanent URL.
        setMessages((m) => {
          const next = m.slice();
          const last = next[next.length - 1];
          if (last?.media) last.media = { kind: att.kind, url: publicUrl };
          return next;
        });
      }

      setTyping(true);
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, media, frames }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Reveal her bubbles one by one with typing pauses so it feels human.
      for (const bubble of data.bubbles || []) {
        await new Promise((r) => setTimeout(r, bubble.delay || 900));
        setMessages((m) => [
          ...m,
          {
            role: "me",
            content: bubble.text,
            at: new Date().toISOString(),
            media: null,
          },
        ]);
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setTyping(false);
      setBusy(false);
      textRef.current?.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (error && !chat) {
    return (
      <div className="center-screen">
        <div style={{ fontSize: 40 }}>💔</div>
        <div>{error}</div>
      </div>
    );
  }

  if (!chat) {
    return <div className="center-screen">loading…</div>;
  }

  const initial = (chat.name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="chat-shell">
      <div className="chat-top">
        <div className="chat-avatar">
          {chat.avatar ? <img src={chat.avatar} alt="" /> : initial}
        </div>
        <div>
          <div className="chat-top-name">{chat.name}</div>
          <div className="chat-top-status online">online now</div>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-note">say hi — she's waiting for you</div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble-row ${m.role === "fan" ? "me" : "her"}`}
          >
            <div className="bubble">
              {m.media?.url &&
                (m.media.kind === "video" ? (
                  <video className="media" src={m.media.url} controls />
                ) : (
                  <img className="media" src={m.media.url} alt="" />
                ))}
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="bubble-row her">
            <div className="typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {error && chat && <div className="chat-note">{error}</div>}
      </div>

      {attachment && (
        <div className="attach-preview">
          {attachment.kind === "video" ? (
            <video src={attachment.previewUrl} muted />
          ) : (
            <img src={attachment.previewUrl} alt="" />
          )}
          <span>{attachment.file.name}</span>
          <button className="attach-remove" onClick={clearAttachment}>
            ✕
          </button>
        </div>
      )}

      <div className="composer">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={onFileChosen}
        />
        <button className="icon-btn" onClick={pickFile} title="Send a photo or video">
          +
        </button>
        <textarea
          ref={textRef}
          rows={1}
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className="icon-btn send-btn"
          onClick={send}
          disabled={busy || (!text.trim() && !attachment)}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
