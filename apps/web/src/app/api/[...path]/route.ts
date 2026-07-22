import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/proxy";

export const dynamic = "force-dynamic";

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  return proxyToApi(req, `/api/${path.join("/")}`);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
