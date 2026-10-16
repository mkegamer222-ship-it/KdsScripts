import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** GET /api/me — usuário da sessão (usado pelo cabeçalho e pela página de conta). */
export async function GET() {
  await ensureBootstrap();
  const user = await getCurrentUser();
  return NextResponse.json(
    { ok: true, user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
