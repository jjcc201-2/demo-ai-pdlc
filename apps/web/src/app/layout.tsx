import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "PDLC — AI Workflow", description: "AI-assisted BRD builder" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "1rem 2rem", borderBottom: "1px solid #eee" }}>
          <a href="/" style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>
            PDLC · AI-Assisted BRD Workflow
          </a>
        </header>
        <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>{children}</main>
      </body>
    </html>
  );
}
