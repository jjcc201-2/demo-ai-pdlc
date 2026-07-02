export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

/** Wraps fetch with a friendly error when the API is unreachable. */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new Error(
      `Could not reach the API at ${API_BASE}. Is the API server running? Start it with \`pnpm dev:api\`. (Underlying: ${
        e instanceof Error ? e.message : String(e)
      })`,
    );
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return (await res.json()) as T;
}

export interface HealthInfo {
  ok: boolean;
  features: { graphTranscript: boolean; githubPublisher: boolean };
}

export async function checkApiHealth(): Promise<HealthInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HealthInfo;
  } catch {
    return null;
  }
}
