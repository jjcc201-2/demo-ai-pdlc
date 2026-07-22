/** @type {import('next').NextConfig} */

// Where the browser should send API calls.
// - Empty string (default) means "same origin": the browser calls /api and
//   /health on the web app's own origin, and Next.js proxies them to the API
//   server-side (see rewrites below). This is what makes GitHub Codespaces work
//   with zero config — the browser only ever talks to the forwarded web port,
//   so there is no second forwarded port to reach and no cross-origin/CORS.
// - Set NEXT_PUBLIC_API_BASE to an absolute URL to bypass the proxy and call a
//   separately-hosted API directly.
const publicApiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";

// Server-side target the proxy forwards to. Inside the dev container / a single
// host this is localhost:4000; override with API_PROXY_TARGET if the API runs
// elsewhere.
const proxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: publicApiBase,
  },
  async rewrites() {
    // Only proxy when the client uses the same origin (no absolute base set).
    if (publicApiBase) return [];
    return [
      { source: "/api/:path*", destination: `${proxyTarget}/api/:path*` },
      { source: "/health", destination: `${proxyTarget}/health` },
    ];
  },
};
export default nextConfig;
