import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth";
import { ensureBootstrap } from "@/lib/bootstrap";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, "login", 12, 60_000);
  if (limited) return limited;

  await ensureBootstrap();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await loginUser(String(body?.username ?? ""), String(body?.password ?? ""));
  if (!result.ok) {
    const status = result.error.startsWith("Banco de dados indisponível") ? 503 : 401;
    return NextResponse.json(
      { ok: false, error: result.error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ ok: true, user: result.user }, { headers: { "Cache-Control": "no-store" } });
}
