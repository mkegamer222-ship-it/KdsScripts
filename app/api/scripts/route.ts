import { NextResponse } from "next/server";
import { listScripts } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/scripts — busca pública (somente scripts publicados). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const result = await listScripts({
    q: searchParams.get("q") || undefined,
    placeId: searchParams.get("placeId") || undefined,
    sort: searchParams.get("sort") || "newest",
    page: Number(searchParams.get("page") || 1),
    limit: Math.min(24, Number(searchParams.get("limit") || 12)),
  });

  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=180" } },
  );
}
