"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Planned {
  type: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  tags?: string[];
  children?: Planned[];
}

interface Project {
  id: string;
  name: string;
}

export default function AdoPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<any>(null);
  const [config, setConfig] = useState<{ configured: boolean; organization: string | null; defaultProject: string | null } | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [project, setProject] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api(`/api/runs/${id}`).then((s: any) => {
      setState(s);
      if (s.adoTargetProject) setProject(s.adoTargetProject);
      else if (s.adoPlan?.project) setProject(s.adoPlan.project);
    }).catch((e) => setError(e.message));
    api<any>("/api/ado/config").then((c) => {
      setConfig(c);
      setProject((prev) => prev || c.defaultProject || "");
    }).catch(() => setConfig({ configured: false, organization: null, defaultProject: null }));
    api<{ projects: Project[] }>("/api/ado/projects")
      .then((r) => setProjects(r.projects))
      .catch(() => setProjects(null));
  }, [id]);

  const setTarget = async (name: string) => {
    setProject(name);
    if (!name) return;
    setBusy(true); setError(null);
    try {
      const s = await api(`/api/runs/${id}/ado/target`, { method: "PUT", body: JSON.stringify({ project: name }) });
      setState(s);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const runPlan = async () => {
    setBusy(true); setError(null);
    try {
      const s = await api(`/api/runs/${id}/stages/ado/run`, { method: "POST" });
      setState(s);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    setBusy(true); setError(null);
    try {
      const s = await api(`/api/runs/${id}/ado/apply`, { method: "POST" });
      setState(s);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!state) return <main className="app-main"><p className="muted">Loading…</p></main>;

  const plan = state.adoPlan;
  const result = state.adoResult;
  const stageStatus = state.stages?.ado?.status ?? "pending";
  const org = config?.organization ?? plan?.organization;

  if (config && !config.configured) {
    return (
      <main className="app-main">
        <section className="card">
          <h2>Azure DevOps stage (7)</h2>
          <p className="muted">This stage is <strong>not configured</strong>. Set <code>PDLC_ADO_ORG</code> in your <code>.env</code> and restart the API.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-main">
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Azure DevOps</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              Stage 7 — an autonomous Copilot agent turns the BRD into an Epic / Feature / User Story tree in
              {org ? <> <code>{org}</code></> : " Azure DevOps"}.
            </p>
          </div>
          <div>
            <label className="small muted" htmlFor="ado-project">Project</label>
            <br />
            {projects ? (
              <select
                id="ado-project"
                value={project}
                onChange={(e) => setTarget(e.target.value)}
                disabled={busy}
              >
                <option value="">— select —</option>
                {projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            ) : (
              <input
                id="ado-project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                onBlur={(e) => e.target.value && setTarget(e.target.value)}
                placeholder="Project name"
                disabled={busy}
              />
            )}
          </div>
        </div>
      </section>

      {error && <div className="banner banner-error">{error}</div>}

      {!plan && (
        <section className="card">
          <p>No plan generated yet.</p>
          <button className="btn btn-primary" onClick={runPlan} disabled={busy || !project}>
            {busy ? "Generating plan…" : "Generate plan"}
          </button>
        </section>
      )}

      {plan && !result && (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Proposed work-item tree</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={runPlan} disabled={busy}>Re-generate</button>
              <button className="btn btn-primary" onClick={apply} disabled={busy || stageStatus === "in_progress"}>
                {busy ? "Applying…" : `Apply to ${plan.project}`}
              </button>
            </div>
          </div>
          {plan.notes && <p className="muted small">{plan.notes}</p>}
          <PlanTree items={plan.hierarchy as Planned[]} />
        </section>
      )}

      {result && (
        <section className="card">
          <h3>Created in Azure DevOps</h3>
          <p className="muted small">{result.workItems.length} work item(s) in <code>{result.project}</code>.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {result.workItems.map((w: any) => (
              <li key={w.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                <span className="pill">{w.type}</span>{" "}
                <a href={w.url || `https://dev.azure.com/${org}/_workitems/edit/${w.id}`} target="_blank" rel="noreferrer">
                  #{w.id} {w.title}
                </a>
                {w.parentId && <span className="muted small"> — child of #{w.parentId}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function PlanTree({ items }: { items: Planned[] }) {
  return (
    <ul className="plan-tree">
      {items.map((it, i) => (
        <PlanNode key={i} item={it} depth={0} />
      ))}
    </ul>
  );
}

function PlanNode({ item, depth }: { item: Planned; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(item.description || item.acceptanceCriteria || (item.tags && item.tags.length));
  const hasChildren = Boolean(item.children && item.children.length);
  return (
    <li className={`plan-node depth-${depth}`}>
      <button
        type="button"
        className="plan-row"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        title={hasDetail ? (open ? "Hide detail" : "Show detail") : ""}
      >
        <span className={`plan-caret ${hasDetail ? "" : "invisible"}`}>{open ? "▾" : "▸"}</span>
        <span className={`plan-type type-${item.type.replace(/\s+/g, "-").toLowerCase()}`}>{item.type}</span>
        <span className="plan-title">{item.title}</span>
      </button>
      {open && hasDetail && (
        <div className="plan-detail">
          {item.description && <p className="muted small">{item.description}</p>}
          {item.acceptanceCriteria && (
            <pre className="small plan-ac">{item.acceptanceCriteria}</pre>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="small muted">{item.tags.map((t) => `#${t}`).join(" ")}</div>
          )}
        </div>
      )}
      {hasChildren && (
        <ul className="plan-tree">
          {item.children!.map((c, i) => (
            <PlanNode key={i} item={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
