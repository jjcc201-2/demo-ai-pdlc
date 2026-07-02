"use client";
import { useEffect, useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { api } from "@/lib/api";

type StageStatus = "pending" | "in_progress" | "done" | "error";

interface StageDef {
  id: "ingest" | "analyze" | "grill" | "draft" | "review" | "publish";
  label: string;
  href?: (runId: string) => string;
}

const STAGES: StageDef[] = [
  { id: "ingest", label: "Ingest" },
  { id: "analyze", label: "Analyze" },
  { id: "grill", label: "Grill", href: (id) => `/runs/${id}/grill` },
  { id: "draft", label: "Draft", href: (id) => `/runs/${id}/review` },
  { id: "review", label: "Review", href: (id) => `/runs/${id}/review` },
  { id: "publish", label: "Publish", href: (id) => `/runs/${id}/review` },
];

export default function RunNav() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [stages, setStages] = useState<Record<string, { status: StageStatus }> | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = () =>
      api<any>(`/api/runs/${id}`)
        .then((s) => { if (!cancelled) setStages(s.stages); })
        .catch(() => {});
    load();
    // Poll while the run is in flight so the nav updates as stages complete.
    const t = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [id, pathname]);

  if (!id) return null;

  return (
    <nav className="run-nav" aria-label="Run stages">
      <div className="run-nav-inner">
        <span className="run-nav-label">Stage</span>
        <ol className="run-nav-list">
          {STAGES.map((s, i) => {
            const status: StageStatus = stages?.[s.id]?.status ?? "pending";
            const reached = status !== "pending";
            const href = s.href?.(id);
            const isActive = href && pathname === href
              // Highlight the specific sub-stage the user is likely viewing
              && (
                (s.id === "grill" && pathname.endsWith("/grill")) ||
                (["draft", "review", "publish"].includes(s.id) && pathname.endsWith("/review"))
              );
            const clickable = reached && !!href;

            const inner = (
              <>
                <span className="run-nav-num">{i + 1}</span>
                <span className="run-nav-name">{s.label}</span>
                <span className={`run-nav-dot ${status}`} aria-hidden />
              </>
            );

            return (
              <li key={s.id} className={`run-nav-item ${status} ${isActive ? "active" : ""} ${clickable ? "clickable" : ""}`}>
                {clickable ? (
                  <a href={href}>{inner}</a>
                ) : (
                  <span title={reached ? "" : "Stage not reached yet"}>{inner}</span>
                )}
                {i < STAGES.length - 1 && <span className="run-nav-sep" aria-hidden>›</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
