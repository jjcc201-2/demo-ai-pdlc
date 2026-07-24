"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, API_BASE, authHeaders } from "@/lib/api";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<any>(null);
  const [markdown, setMarkdown] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/runs/${id}`)
      .then((s: any) => { setState(s); setMarkdown(s.brdMarkdown ?? ""); })
      .catch((e) => setError(e.message));
  }, [id]);

  const publish = async (force = false) => {
    setBusy(true); setError(null);
    try {
      const s = await api(`/api/runs/${id}/stages/publish/run`, {
        method: "POST",
        body: JSON.stringify(force ? { force: true } : {}),
      });
      setState(s);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const saveEdits = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/runs/${id}/brd`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ markdown }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const s = await res.json();
      setState(s);
      setDirty(false);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const rerunReview = async () => {
    setBusy(true); setError(null);
    try { setState(await api(`/api/runs/${id}/stages/review/run`, { method: "POST" })); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!state) return <p>Loading…</p>;
  const findings: any[] = state.review?.findings ?? [];
  const critical = findings.filter((f) => f.severity === "critical").length;
  const published = Boolean(state.publish?.localPath);

  return (
    <div>
      <h1>Review <code>{id}</code></h1>
      <p className="muted small">
        Inspect findings, edit the BRD inline, then publish.
      </p>

      <div className="card">
        <h3>Review findings ({findings.length})</h3>
        {findings.length === 0 && <p>No findings.</p>}
        <ul>
          {findings.map((f, i) => (
            <li key={i}>
              <span className={`pill ${f.severity === "critical" ? "error" : f.severity === "warning" ? "in_progress" : "pending"}`}>
                {f.severity}
              </span>{" "}
              <strong>{f.section}:</strong> {f.message}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>BRD markdown {state.brdEditedByUser && <span className="pill in_progress">edited</span>}</h3>
        <p style={{ color: "#666", fontSize: 12, margin: "0 0 8px" }}>
          Edit directly to fix findings, then <em>Save &amp; re-run review</em>. Or skip straight to publish with the override button.
        </p>
        <textarea
          value={markdown}
          rows={20}
          onChange={(e) => { setMarkdown(e.target.value); setDirty(true); }}
          style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button disabled={busy || !dirty} onClick={saveEdits}>Save edits</button>
          <button disabled={busy} onClick={rerunReview}>Re-run review</button>
        </div>
      </div>

      {published ? (
        <div className="card">
          <p>✅ Published to <code>{state.publish.localPath}</code></p>
          {state.publish.github && (
            <p>GitHub commit: <code>{state.publish.github.commitSha}</code> at <code>{state.publish.github.path}</code></p>
          )}
          <a className="btn btn-primary" href={`/runs/${id}/ado`}>Continue to Azure DevOps →</a>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="primary"
              disabled={busy || critical > 0 || dirty}
              onClick={() => publish(false)}
              title={dirty ? "Save your edits first" : critical > 0 ? "Blocked by critical findings" : ""}
            >
              Publish BRD
            </button>
            {critical > 0 && (
              <button
                disabled={busy || dirty}
                onClick={() => {
                  if (confirm(`Override ${critical} critical finding(s) and publish anyway?`)) publish(true);
                }}
                style={{ borderColor: "#dc2626", color: "#dc2626" }}
              >
                Ignore &amp; publish anyway
              </button>
            )}
            {dirty && <span style={{ color: "#92400e" }}>You have unsaved edits.</span>}
          </div>
        </div>
      )}

      {error && <div className="card danger"><strong>Error:</strong> {error}</div>}
    </div>
  );
}
