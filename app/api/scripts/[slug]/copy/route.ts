import { NextResponse } from "next/server";
import { increment } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/scripts/:slug/copy — registra uma cópia do código. */
export async function POST(req: Request, ctx: Ctx) {
  const limited = rateLimit(req, "copy", 60, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const ok = await increment(slug, "copies");
  return NextResponse.json({ ok });
}
