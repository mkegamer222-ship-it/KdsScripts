import { NextResponse } from "next/server";
import { increment } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/scripts/:slug/view — registra uma visualização. */
export async function POST(req: Request, ctx: Ctx) {
  const limited = rateLimit(req, "view", 120, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const ok = await increment(slug, "views");
  return NextResponse.json({ ok });
}
