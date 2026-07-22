/** @type {import('next').NextConfig} */

// Where the browser should send API calls.
// - Empty string (default) means "same origin": the browser calls /api and
//   /health on the web app's own origin. Next.js Route Handlers
//   (src/app/api/[...path]/route.ts and src/app/health/route.ts) proxy those to
//   the API server-side, stripping the Origin header so the API accepts them.
//   This makes GitHub Codespaces (and HTTPS localhost port-forwarding) work with
//   zero config — the browser only talks to the forwarded web port, so there is
//   no second forwarded port to reach and no cross-origin/CORS.
// - Set NEXT_PUBLIC_API_BASE to an absolute URL to bypass the proxy and call a
//   separately-hosted API directly.
const publicApiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: publicApiBase,
  },
};
export default nextConfig;
