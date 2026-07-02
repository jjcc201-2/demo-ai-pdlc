import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Product Manager Command Centre",
  description: "AI-assisted product development lifecycle workflow",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg-grid" aria-hidden />
        <header className="app-header">
          <a href="/" className="brand">
            <span className="brand-mark" aria-hidden>◆</span>
            <span className="brand-text">
              <span className="brand-title">Product Manager Command Centre</span>
              <span className="brand-sub">AI-assisted product development lifecycle</span>
            </span>
          </a>
        </header>
        <main className="app-main">{children}</main>
        <footer className="app-footer">
          <span>powered by GitHub Copilot SDK</span>
          <span className="footer-dot">●</span>
          <span>PDLC v0.1</span>
        </footer>
      </body>
    </html>
  );
}
