"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function GrillPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setState(await api(`/api/runs/${id}`)); } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(); }, [id]);

  const askNext = async () => {
    setBusy(true); setError(null);
    try { setState(await api(`/api/runs/${id}/stages/grill/run`, { method: "POST" })); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/runs/${id}/grill/answer`, { method: "POST", body: JSON.stringify({ answer }) });
      setAnswer("");
      await askNext();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const finishAndDraft = async () => {
    setBusy(true); setError(null);
    try {
      await api(`/api/runs/${id}/stages/draft/run`, { method: "POST" });
      await api(`/api/runs/${id}/stages/review/run`, { method: "POST" });
      window.location.href = `/runs/${id}/review`;
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!state) return <p>Loading…</p>;
  const rounds: any[] = state.grilling?.rounds ?? [];
  const pending = rounds.at(-1);
  const consensus = state.grilling?.consensusReached;

  return (
    <div>
      <h1>Grilling <code>{id}</code></h1>
      <p className="muted small">
        The AI asks focused questions to lock down business value. No technical talk.
      </p>

      <div className="card">
        <h3>Analyzer summary</h3>
        <p style={{ margin: 0 }}>{state.analysis?.summary}</p>
      </div>

      <div className="card">
        <h3>Conversation</h3>
        <div className="chat">
          {rounds.length === 0 && <p className="muted small">Click <em>Start grilling</em> below to get the first question.</p>}
          {rounds.map((r, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div className="bubble ai">
                <span className="who">Analyst AI <span className="section-tag">{r.brdSection}</span></span>
                {r.question}
              </div>
              {r.answer && (
                <div className="bubble user">
                  <span className="who">You</span>
                  {r.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {!consensus && pending && !pending.answer && (
        <div className="card">
          <label>Your answer</label>
          <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer the question above — focus on business value (what & why)…" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" disabled={busy} onClick={submitAnswer}>
              {busy ? "Sending…" : "Submit answer"}
            </button>
            <span className="muted small">Round {rounds.length} of {rounds.length}</span>
          </div>
        </div>
      )}

      {!consensus && rounds.length === 0 && (
        <button className="primary" disabled={busy} onClick={askNext}>
          {busy ? "Warming up the AI…" : "Start grilling"}
        </button>
      )}

      {consensus && (
        <div className="card">
          <div className="row">
            <span className="pill done">Consensus reached</span>
            <span className="muted small">{state.grilling.reason}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="primary" disabled={busy} onClick={finishAndDraft}>
              {busy ? "Drafting BRD…" : "Draft & review BRD →"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="card danger"><strong>Error:</strong> {error}</div>}
    </div>
  );
}
