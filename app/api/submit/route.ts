import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { bustDataCache } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { isValidPlaceId } from "@/lib/roblox";
import { parseList, uniqueSlug, upsertGameFromPlaceId } from "@/lib/actions-helpers";
import type { ScriptDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/submit — publica um script (membro: fica pendente; staff: publica direto). */
export async function POST(req: Request) {
  const limited = rateLimit(req, "submit", 10, 60_000);
  if (limited) return limited;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Entre na sua conta para publicar." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const title = String(body?.title ?? "").trim().slice(0, 160);
  const description = String(body?.description ?? "").trim().slice(0, 1500);
  const code = String(body?.code ?? "");
  const placeId = String(body?.placeId ?? "").replace(/\D/g, "");
  const version = String(body?.version ?? "1.0.0").trim().slice(0, 24) || "1.0.0";
  const keySystem = Boolean(body?.keySystem);
  const tags = parseList(Array.isArray(body?.tags) ? body.tags.join(",") : body?.tags, 10);
  const features = parseList(
    Array.isArray(body?.features) ? body.features.join("\n") : body?.features,
    12,
  );

  if (title.length < 3) return NextResponse.json({ ok: false, error: "Título muito curto." }, { status: 400 });
  if (!isValidPlaceId(placeId)) {
    return NextResponse.json({ ok: false, error: "Place ID inválido (use apenas números)." }, { status: 400 });
  }
  if (code.trim().length < 10) {
    return NextResponse.json({ ok: false, error: "Cole o código do script." }, { status: 400 });
  }
  if (code.length > 200_000) {
    return NextResponse.json({ ok: false, error: "Código muito grande (limite de 200 mil caracteres)." }, { status: 400 });
  }

  const staff = isStaff(user);

  try {
    const { game, error } = await upsertGameFromPlaceId(placeId, user.username, staff);
    if (!game) return NextResponse.json({ ok: false, error: error || "Place ID inválido." }, { status: 400 });

    const db = await getDb();
    const slug = await uniqueSlug(title);

    const doc: ScriptDoc = {
      slug,
      title,
      description,
      code,
      placeId: game.placeId,
      gameName: game.name,
      gameThumbnail: game.thumbnail ?? null,
      tags,
      features,
      version,
      keySystem,
      status: staff ? "approved" : "pending",
      authorId: user.id,
      authorName: user.username,
      views: 0,
      likes: 0,
      copies: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("scripts").insertOne(doc as any);
    bustDataCache();

    return NextResponse.json({
      ok: true,
      slug,
      status: doc.status,
      gamePending: game.status === "pending",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
