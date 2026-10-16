import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import { ensureBootstrap } from "@/lib/bootstrap";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, "register", 6, 60_000);
  if (limited) return limited;

  await ensureBootstrap();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await registerUser(
    String(body?.username ?? ""),
    String(body?.password ?? ""),
    body?.displayName ? String(body.displayName) : undefined,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user: result.user }, { headers: { "Cache-Control": "no-store" } });
}
