// The web app only serves the public chat pages (/c/<chatId>). Chats are
// created and run from the Orion desktop app.
export default function HomePage() {
  return (
    <div className="center-screen">
      <div style={{ fontSize: 40 }}>💌</div>
      <div>nothing here — you need a personal chat link</div>
    </div>
  );
}
