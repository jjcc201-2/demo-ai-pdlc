"use client";
import { useEffect, useState } from "react";
import { API_BASE, api, checkApiHealth, type HealthInfo } from "@/lib/api";

interface RunSummary {
  runId: string;
  createdAt: string;
  stages: Record<string, { status: string }>;
}

export default function Home() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthInfo | null | "loading">("loading");

  const refresh = async () => {
    try { setRuns(await api<RunSummary[]>("/api/runs")); } catch (e: any) { setError(e.message); }
  };
  useEffect(() => {
    checkApiHealth().then(setHealth);
    refresh();
  }, []);

  const start = async () => {
    if (!file) { setError("Choose a transcript file"); return; }
    setBusy(true); setError(null);
    try {
      const run = await api<RunSummary>("/api/runs", { method: "POST" });
      const fd = new FormData();
      fd.append("file", file);
      if (subject) fd.append("subject", subject);
      let up: Response;
      try {
        up = await fetch(`${API_BASE}/api/runs/${run.runId}/transcript/upload`, { method: "POST", body: fd });
      } catch (e) {
        throw new Error(
          `Could not reach the API at ${API_BASE} while uploading. Is the API server running? Start it with \`pnpm dev:api\`.`,
        );
      }
      if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);
      await api(`/api/runs/${run.runId}/stages/ingest/run`, { method: "POST" });
      await api(`/api/runs/${run.runId}/stages/analyze/run`, { method: "POST" });
      window.location.href = `/runs/${run.runId}/grill`;
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <h1>Start a new PDLC run</h1>

      {health === "loading" && <p style={{ color: "#666" }}>Checking API…</p>}
      {health === null && (
        <div className="card" style={{ borderColor: "#fca5a5", background: "#fef2f2" }}>
          <strong>⚠️ API is not reachable at <code>{API_BASE}</code>.</strong>
          <p style={{ margin: "8px 0 0" }}>
            Open a terminal and run <code>pnpm dev:api</code> in the project root, then reload this page.
          </p>
        </div>
      )}
      {health && typeof health !== "string" && (
        <p style={{ color: "#166534", fontSize: 12 }}>
          ✓ API reachable at <code>{API_BASE}</code>
          {" · "}Graph transcript: {health.features.graphTranscript ? "enabled" : "not configured"}
          {" · "}GitHub publisher: {health.features.githubPublisher ? "enabled" : "not configured"}
        </p>
      )}

      <div className="card">
        <label>Meeting subject (optional)</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Q3 product ideation" />
        <div style={{ marginTop: 12 }}>
          <label>Transcript (.vtt / .docx / .txt)</label>
          <input type="file" accept=".vtt,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="primary" onClick={start} disabled={busy}>
            {busy ? "Starting…" : "Start run"}
          </button>
        </div>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </div>

      <h2>Recent runs</h2>
      {runs.length === 0 && <p style={{ color: "#666" }}>No runs yet.</p>}
      {runs.map((r) => (
        <div key={r.runId} className="card">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <a href={`/runs/${r.runId}/grill`}><code>{r.runId}</code></a>
            <span style={{ color: "#666" }}>{new Date(r.createdAt).toLocaleString()}</span>
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(r.stages).map(([k, v]) => (
              <span key={k} className={`pill ${v.status}`}>{k}: {v.status}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
