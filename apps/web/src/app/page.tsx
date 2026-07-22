"use client";
import { useEffect, useState } from "react";
import { API_BASE, api, authHeaders, checkApiHealth, type HealthInfo } from "@/lib/api";

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
        up = await fetch(`${API_BASE}/api/runs/${run.runId}/transcript/upload`, { method: "POST", body: fd, headers: authHeaders() });
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
      <h1>Start a new run</h1>
      <p className="muted small">
        Upload a Teams meeting transcript. The AI will analyze it, grill you for consensus on business value, draft a BRD, review it, and publish.
      </p>

      {health === "loading" && <p className="muted small">Checking API…</p>}
      {health === null && (
        <div className="card danger">
          <strong>⚠️ API is not reachable at <code>{API_BASE}</code>.</strong>
          <p style={{ margin: "8px 0 0" }} className="small">
            Open a terminal and run <code>pnpm dev-api</code> in the project root, then reload this page.
          </p>
        </div>
      )}
      {health && typeof health !== "string" && (
        <div className="row small" style={{ marginBottom: 12 }}>
          <span className="pill done">API online</span>
          <span className="pill pending">
            Graph: {health.features.graphTranscript ? "on" : "off"}
          </span>
          <span className="pill pending">
            GitHub publisher: {health.features.githubPublisher ? "on" : "off"}
          </span>
          <span className="muted">· {API_BASE}</span>
        </div>
      )}

      <div className="card">
        <label>Meeting subject (optional)</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Q3 product ideation" />
        <div style={{ marginTop: 12 }}>
          <label>Transcript (.vtt / .docx / .txt)</label>
          <input type="file" accept=".vtt,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="primary" onClick={start} disabled={busy || health === null}>
            {busy ? "Starting run…" : "Start run"}
          </button>
        </div>
        {error && <div className="card danger" style={{ margin: "12px 0 0" }}><strong>Error:</strong> {error}</div>}
      </div>

      <h2>Recent runs</h2>
      {runs.length === 0 && <p className="muted">No runs yet.</p>}
      {runs.map((r) => (
        <div key={r.runId} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <a href={`/runs/${r.runId}/grill`}><code>{r.runId}</code></a>
            <span className="muted small">{new Date(r.createdAt).toLocaleString()}</span>
          </div>
          <div className="stepper" style={{ marginTop: 10 }}>
            {Object.entries(r.stages).map(([k, v]) => (
              <span key={k} className={`step ${v.status}`}>{k}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
