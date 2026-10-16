import { NextResponse } from "next/server";
import { getScript } from "@/lib/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/scripts/:slug — script publicado (o código sai daqui para copiar). */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const script = await getScript(slug, "approved");

  if (!script) {
    return NextResponse.json({ ok: false, error: "Script não encontrado." }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, script },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
