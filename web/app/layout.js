import "./globals.css";

export const metadata = {
  title: "Orion",
  description: "Chat with me",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
