import { NextResponse } from "next/server";

/**
 * Limite simples em memória (por instância) para conter abuso em rotas sensíveis.
 * Suficiente para login/registro/cadastro; não substitui um rate limit distribuído.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientKey(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return ip;
}

export function rateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${clientKey(req)}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= limit) return null;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return NextResponse.json(
    { ok: false, error: "Muitas tentativas. Aguarde um instante e tente de novo." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
