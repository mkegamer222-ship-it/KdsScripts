import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/mysql";
import { bustDataCache } from "@/lib/data";
import { upsertGameFromPlaceId } from "@/lib/actions-helpers";
import { isValidPlaceId } from "@/lib/roblox";

export const dynamic = "force-dynamic";

/** POST /api/staff/games — staff cadastra e valida um jogo pelo Place ID. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!isStaff(user?.role)) {
    return NextResponse.json({ ok: false, error: "Acesso restrito à staff." }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const placeId = String(body?.placeId ?? "").replace(/\D/g, "");
  if (!isValidPlaceId(placeId)) {
    return NextResponse.json({ ok: false, error: "Place ID inválido (use apenas números)." }, { status: 400 });
  }

  try {
    const { game, created, error } = await upsertGameFromPlaceId(placeId, user!.username, true);
    if (!game) return NextResponse.json({ ok: false, error: error || "Falha ao cadastrar." }, { status: 400 });

    const db = await getDb();
    await db
      .collection("games")
      .updateOne(
        { placeId: game.placeId },
        {
          $set: {
            status: "approved",
            reviewedBy: user!.username,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );

    bustDataCache();

    return NextResponse.json({
      ok: true,
      message: created ? `Jogo "${game.name}" cadastrado e validado.` : `Jogo "${game.name}" atualizado.`,
      game: { placeId: game.placeId, name: game.name },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao cadastrar o jogo." }, { status: 500 });
  }
}
