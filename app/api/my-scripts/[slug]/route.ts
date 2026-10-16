import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** GET — um script do próprio autor (ou qualquer um, se staff). Traz o código completo. */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  try {
    const db = await getDb();
    const script = await db.collection("scripts").findOne({ slug }, { projection: { _id: 0 } });
    if (!script) return NextResponse.json({ ok: false, error: "Script não encontrado." }, { status: 404 });
    if (script.authorId !== user.id && !isStaff(user)) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    return NextResponse.json({ ok: true, script }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao carregar." }, { status: 500 });
  }
}

/** DELETE — remove o script (autor ou staff). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  try {
    const db = await getDb();
    const script = await db.collection("scripts").findOne({ slug });
    if (!script) return NextResponse.json({ ok: false, error: "Script não encontrado." }, { status: 404 });
    if (script.authorId !== user.id && !isStaff(user)) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    await db.collection("scripts").deleteOne({ slug });
    const { bustDataCache } = await import("@/lib/data");
    bustDataCache();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao remover." }, { status: 500 });
  }
}
