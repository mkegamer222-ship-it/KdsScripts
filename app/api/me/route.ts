import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** GET /api/me — usuário da sessão (usado pelo cabeçalho e pela página de conta). */
export async function GET() {
  try {
    await ensureBootstrap();
    const user = await getCurrentUser();
    return NextResponse.json(
      { ok: true, user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[api/me] não foi possível verificar a sessão:", err?.code || err?.name || "erro desconhecido");
    return NextResponse.json(
      { ok: false, error: "Não foi possível verificar sua sessão agora. Tente novamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
