import type { NextRequest } from "next/server";

// Server-side target the proxy forwards to. Inside the dev container / a single
// host this is localhost:4000; override with API_PROXY_TARGET if the API runs
// elsewhere.
const TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

// Headers we must not forward from the browser to the API. Crucially this
// includes `origin` and `referer`: the browser sets them to the web app's own
// origin (e.g. https://localhost:3000 or a Codespaces forwarded URL), and
// forwarding them would make the API's CORS allowlist reject the request. By
// stripping them the proxied call looks like a trusted server-to-server request
// (no Origin header), which the API allows — while still enforcing CORS for any
// direct browser access to the API port.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "accept-encoding",
]);

/**
 * Proxy an incoming Next.js request to the API server, stripping origin-related
 * headers so the API treats it as a same-host server-to-server call. This is
 * what lets the web UI reach the API in GitHub Codespaces (and any HTTPS
 * localhost port-forwarding) without cross-origin/CORS friction.
 */
export async function proxyToApi(req: NextRequest, targetPath: string): Promise<Response> {
  const url = new URL(req.url);
  const target = `${TARGET}${targetPath}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : Buffer.from(await req.arrayBuffer());

  let res: Response;
  try {
    res = await fetch(target, { method, headers, body, redirect: "manual" });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: `Proxy could not reach the API at ${TARGET}. Is the API server running? (${
          e instanceof Error ? e.message : String(e)
        })`,
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const resHeaders = new Headers(res.headers);
  // The API returns an identity-encoded body (we stripped accept-encoding);
  // remove framing headers so the runtime re-computes them for our response.
  resHeaders.delete("content-encoding");
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("content-length");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}
