import { NextResponse } from "next/server";
import { increment } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/scripts/:slug/like */
export async function POST(req: Request, ctx: Ctx) {
  const limited = rateLimit(req, "like", 30, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const ok = await increment(slug, "likes");
  return NextResponse.json({ ok });
}
