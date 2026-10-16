import { NextResponse } from "next/server";
import { listGames } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/games — jogos validados (usado nos filtros). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") || 100));
  const q = url.searchParams.get("q") || undefined;

  const result = await listGames({ limit, q, status: "approved" });

  return NextResponse.json(
    { ok: true, items: result.items, total: result.total },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
