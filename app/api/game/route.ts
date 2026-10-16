import { NextResponse } from "next/server";
import { getGameByPlaceId, isValidPlaceId } from "@/lib/roblox";
import { getGame } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/game?placeId=123 — nome/capa do jogo a partir do Place ID. */
export async function GET(req: Request) {
  const placeId = new URL(req.url).searchParams.get("placeId") || "";

  if (!isValidPlaceId(placeId)) {
    return NextResponse.json({ ok: false, error: "Place ID inválido." }, { status: 400 });
  }

  // se já existe no banco, usa o que está guardado (mais rápido e consistente)
  const stored = await getGame(placeId, undefined);
  if (stored?.name) {
    return NextResponse.json(
      {
        ok: true,
        game: {
          placeId: stored.placeId,
          name: stored.name,
          creator: stored.creator,
          thumbnail: stored.thumbnail,
          resolved: true,
          status: stored.status,
          source: "banco",
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  }

  const info = await getGameByPlaceId(placeId);
  return NextResponse.json(
    { ok: true, game: { ...info, source: "roblox" } },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
