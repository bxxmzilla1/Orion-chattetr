"use client";

import { useCallback, useEffect, useState } from "react";

function api(pass) {
  const headers = { "Content-Type": "application/json", "x-admin-pass": pass };
  return {
    get: (url) => fetch(url, { headers }).then((r) => r.json()),
    post: (url, body) =>
      fetch(url, { method: "POST", headers, body: JSON.stringify(body) }).then(
        (r) => r.json()
      ),
    put: (url, body) =>
      fetch(url, { method: "PUT", headers, body: JSON.stringify(body) }).then(
        (r) => r.json()
      ),
    del: (url) => fetch(url, { method: "DELETE", headers }).then((r) => r.json()),
  };
}

export default function AdminPage() {
  const [pass, setPass] = useState("");
  const [entered, setEntered] = useState(false);
  const [chats, setChats] = useState([]);
  const [status, setStatus] = useState("");
  const [newName, setNewName] = useState("");
  const [persona, setPersona] = useState("");
  const [girlName, setGirlName] = useState("Orion");
  const [personaStatus, setPersonaStatus] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAll = useCallback(
    async (p) => {
      const client = api(p);
      const [chatsRes, settingsRes] = await Promise.all([
        client.get("/api/chats"),
        client.get("/api/settings"),
      ]);
      if (chatsRes.error) throw new Error(chatsRes.error);
      setChats(chatsRes.chats || []);
      if (!settingsRes.error) {
        setPersona(settingsRes.persona || "");
        setGirlName(settingsRes.girlName || "Orion");
      }
    },
    []
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("orion-admin-pass");
    if (saved) {
      setPass(saved);
      loadAll(saved)
        .then(() => setEntered(true))
        .catch(() => sessionStorage.removeItem("orion-admin-pass"));
    }
  }, [loadAll]);

  async function unlock(e) {
    e.preventDefault();
    setStatus("");
    try {
      await loadAll(pass);
      sessionStorage.setItem("orion-admin-pass", pass);
      setEntered(true);
    } catch {
      setStatus("Wrong passcode.");
    }
  }

  function chatLink(id) {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base.replace(/\/$/, "")}/c/${id}`;
  }

  async function createChat(e) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setStatus("");
    try {
      const res = await api(pass).post("/api/chats", { name: newName });
      if (res.error) throw new Error(res.error);
      setNewName("");
      await loadAll(pass);
      await navigator.clipboard
        .writeText(chatLink(res.chat.id))
        .catch(() => {});
      setStatus(`Chat created — link copied: ${chatLink(res.chat.id)}`);
    } catch (err) {
      setStatus(String(err.message || err));
    } finally {
      setCreating(false);
    }
  }

  async function removeChat(id) {
    if (!confirm("Delete this chat and its transcript?")) return;
    await api(pass).del(`/api/chats/${id}`);
    await loadAll(pass);
  }

  async function copyLink(id) {
    await navigator.clipboard.writeText(chatLink(id)).catch(() => {});
    setStatus("Link copied.");
  }

  async function savePersona() {
    setPersonaStatus("Saving…");
    const res = await api(pass).put("/api/settings", { persona, girlName });
    setPersonaStatus(res.error ? res.error : "Saved.");
  }

  if (!entered) {
    return (
      <div className="center-screen">
        <form onSubmit={unlock} className="card" style={{ width: 340 }}>
          <h2>Orion admin</h2>
          <div className="row">
            <input
              className="text-input"
              type="password"
              placeholder="Passcode"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
            />
            <button className="btn" type="submit">
              Enter
            </button>
          </div>
          <div className="status-line">{status}</div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-title">Orion</div>
      <div className="admin-sub">
        Create a chat, share the link, and she handles the conversation —
        persona, journal, photos and videos included.
      </div>

      <div className="card">
        <h2>New chat</h2>
        <form className="row" onSubmit={createChat}>
          <input
            className="text-input"
            placeholder="His name (optional — helps her address him)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create + copy link"}
          </button>
        </form>
        <div className="status-line">{status}</div>
      </div>

      <div className="card">
        <h2>Chats ({chats.length})</h2>
        {chats.length === 0 && (
          <div className="status-line">No chats yet — create one above.</div>
        )}
        {chats.map((c) => (
          <div className="chat-list-item" key={c.id}>
            <div className="chat-avatar" style={{ width: 38, height: 38 }}>
              {(c.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="cli-meta">
              <div className="cli-name">{c.name}</div>
              <div className="cli-last">{c.lastMessage || "No messages yet"}</div>
              <a
                className="cli-link"
                href={`/c/${c.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {chatLink(c.id)}
              </a>
            </div>
            <button className="btn ghost" onClick={() => copyLink(c.id)}>
              Copy link
            </button>
            <button className="btn danger" onClick={() => removeChat(c.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Persona (used for every chat unless a chat has its own)</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <input
            className="text-input"
            placeholder="Her display name (shown at the top of the chat page)"
            value={girlName}
            onChange={(e) => setGirlName(e.target.value)}
          />
        </div>
        <textarea
          className="text-input"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="Describe exactly who she is — name, age, vibe, backstory, how she talks…"
        />
        <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
          <button className="btn" onClick={savePersona}>
            Save persona
          </button>
          <div className="status-line" style={{ marginTop: 0 }}>
            {personaStatus}
          </div>
        </div>
      </div>
    </div>
  );
}
