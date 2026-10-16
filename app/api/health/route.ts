import { NextResponse } from "next/server";
import { pingDb } from "@/lib/mongodb";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — usado internamente (monitoramento).
 * Resposta mínima para visitantes; detalhes apenas para a staff autenticada.
 */
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  const status = await pingDb(debug);

  const user = await getCurrentUser().catch(() => null);
  const canSeeDetails = isStaff(user?.role);

  if (!canSeeDetails) {
    return NextResponse.json(
      { ok: status.ok },
      { status: status.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: status.ok,
      banco: status.db,
      latenciaMs: status.latencyMs,
      scripts: status.scripts,
      erro: status.error,
      detalhe: (status as any).extra,
    },
    { status: status.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
