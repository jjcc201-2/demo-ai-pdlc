import "dotenv/config";
import path from "node:path";

function bool(v: string | undefined, def = false): boolean {
  if (v === undefined) return def;
  return /^(1|true|yes)$/i.test(v);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  model: process.env.PDLC_MODEL ?? "claude-sonnet-4.5",
  maxGrillRounds: Number(process.env.PDLC_MAX_GRILL_ROUNDS ?? 6),
  redactPii: bool(process.env.PDLC_REDACT_PII, false),
  runsDir: path.resolve(process.cwd(), "runs"),
  outDir: path.resolve(process.cwd(), "out"),
  copilot: {
    gitHubToken: process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
  },
  graph: {
    tenantId: process.env.GRAPH_TENANT_ID,
    clientId: process.env.GRAPH_CLIENT_ID,
    clientSecret: process.env.GRAPH_CLIENT_SECRET,
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH ?? "main",
    pathPrefix: process.env.GITHUB_PATH_PREFIX ?? "docs/brd",
  },
};

export function githubPublisherConfigured(): boolean {
  const g = config.github;
  return Boolean(g.token && g.owner && g.repo);
}
