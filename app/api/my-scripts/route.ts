import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/mysql";
import { bustDataCache } from "@/lib/data";
import { parseList } from "@/lib/actions-helpers";

export const dynamic = "force-dynamic";

/** GET /api/my-scripts — scripts do usuário logado (staff vê todos, com ?all=1). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const all = new URL(req.url).searchParams.get("all") === "1" && isStaff(user);

  try {
    const db = await getDb();
    const filter = all ? {} : { authorId: user.id };
    const items = await db
      .collection("scripts")
      .find(filter, { projection: { _id: 0, code: 0 } })
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json(
      { ok: true, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, items: [] }, { status: 500 });
  }
}

/** PATCH /api/my-scripts — edita um script (autor ou staff). Volta para a fila de análise. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const slug = String(body?.slug ?? "");
  const title = String(body?.title ?? "").trim().slice(0, 160);
  const code = String(body?.code ?? "");

  if (!slug) return NextResponse.json({ ok: false, error: "Script não informado." }, { status: 400 });
  if (title.length < 3) return NextResponse.json({ ok: false, error: "Título muito curto." }, { status: 400 });
  if (code.trim().length < 10) return NextResponse.json({ ok: false, error: "Cole o código do script." }, { status: 400 });

  try {
    const db = await getDb();
    const existing = await db.collection("scripts").findOne({ slug });
    if (!existing) return NextResponse.json({ ok: false, error: "Script não encontrado." }, { status: 404 });

    const owner = existing.authorId === user.id;
    if (!owner && !isStaff(user)) {
      return NextResponse.json({ ok: false, error: "Você não pode editar este script." }, { status: 403 });
    }

    const staff = isStaff(user);
    await db.collection("scripts").updateOne(
      { slug },
      {
        $set: {
          title,
          description: String(body?.description ?? "").trim().slice(0, 1500),
          code,
          version: String(body?.version ?? "1.0.0").trim().slice(0, 24) || "1.0.0",
          keySystem: Boolean(body?.keySystem),
          tags: parseList(Array.isArray(body?.tags) ? body.tags.join(",") : body?.tags, 10),
          features: parseList(
            Array.isArray(body?.features) ? body.features.join("\n") : body?.features,
            12,
          ),
          status: staff ? "approved" : "pending",
          updatedAt: new Date(),
        },
      },
    );

    bustDataCache();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível salvar." }, { status: 500 });
  }
}

/** DELETE /api/my-scripts?slug=xxx — remove (autor ou staff). */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const slug = new URL(req.url).searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Informe o slug." }, { status: 400 });

  try {
    const db = await getDb();
    const existing = await db.collection("scripts").findOne({ slug });
    if (!existing) return NextResponse.json({ ok: false, error: "Script não encontrado." }, { status: 404 });
    if (existing.authorId !== user.id && !isStaff(user)) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    await db.collection("scripts").deleteOne({ slug });
    bustDataCache();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível remover." }, { status: 500 });
  }
}
