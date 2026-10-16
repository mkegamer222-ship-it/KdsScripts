import { MongoClient, Db } from "mongodb";
import { getLocalDb } from "./local-store";

/**
 * Conexão com o MongoDB reaproveitada entre invocações + CIRCUIT BREAKER.
 *
 * Por que isso existe: se o banco estiver inacessível, o driver ficaria
 * esperando o timeout em CADA request (10s de lentidão por página).
 * Agora: na primeira falha o circuito abre e, por um período de cooldown,
 * todas as chamadas falham na hora (0ms) — o site serve o conteúdo em cache
 * e continua rápido, tentando o banco de novo só depois do cooldown.
 *
 * Estratégias de conexão (na ordem):
 *  1. MONGODB_URI   → string completa (mongodb+srv://... ou mongodb://...)
 *  2. MONGODB_HOSTS → hosts explícitos, separados por vírgula
 *  3. MONGODB_USERNAME + MONGODB_PASSWORD + MONGODB_HOST → monta a URI
 */

const DB_NAME = process.env.MONGODB_DB || "kdss";

/** Tempo máximo esperando o banco NA PRIMEIRA tentativa (depois disso o site responde sem banco) */
const SERVER_SELECTION_MS = Number(process.env.MONGODB_TIMEOUT_MS || 2500);
/** Quanto tempo o circuito fica aberto (sem tentar conectar) depois de uma falha */
const COOLDOWN_MS = Number(process.env.MONGODB_COOLDOWN_MS || 60_000);

/**
 * Existe alguma configuração de Mongo? Sem nada disso o site roda em
 * MODO LOCAL: os dados ficam no arquivo `data/local-db.json` (sem banco).
 */
export function mongoConfigured(): boolean {
  if (process.env.MONGODB_URI?.trim()) return true;
  if (process.env.MONGODB_HOSTS?.trim()) return true;
  if (process.env.MONGODB_HOST?.trim()) return true;
  return false;
}

function buildUri(): string {
  const direct = process.env.MONGODB_URI?.trim();
  if (direct) return direct;

  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;

  const hosts = process.env.MONGODB_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean);
  if (hosts?.length) {
    if (!user || !pass) {
      throw new Error("MONGODB_HOSTS exige MONGODB_USERNAME e MONGODB_PASSWORD.");
    }
    return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hosts.join(
      ",",
    )}/?authSource=admin&retryWrites=true&w=majority&tls=true`;
  }

  const host = process.env.MONGODB_HOST;
  if (user && pass && host) {
    return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(
      pass,
    )}@${host}/?retryWrites=true&w=majority&appName=kdss`;
  }

  throw new Error(
    "MongoDB não configurado: defina MONGODB_URI (ou USERNAME/PASSWORD/HOST) nas variáveis de ambiente. " +
      "Sem configuração o site roda em modo local (data/local-db.json).",
  );
}

/* ------------------------------------------------------------------ */
/* Circuit breaker                                                     */
/* ------------------------------------------------------------------ */

type Breaker = {
  openUntil: number;
  lastError: string | null;
  lastFailureAt: number | null;
  failures: number;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoBreaker: Breaker | undefined;
}

const breaker: Breaker = (global._mongoBreaker ??= {
  openUntil: 0,
  lastError: null,
  lastFailureAt: null,
  failures: 0,
});

export class DbUnavailableError extends Error {
  code = "DB_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

export function dbState() {
  const now = Date.now();
  return {
    circuitoAberto: now < breaker.openUntil,
    retryEmMs: Math.max(0, breaker.openUntil - now),
    falhasSeguidas: breaker.failures,
    ultimoErro: breaker.lastError,
    desde: breaker.lastFailureAt ? new Date(breaker.lastFailureAt).toISOString() : null,
  };
}

function openCircuit(err: unknown) {
  breaker.failures += 1;
  breaker.lastError = (err as any)?.message || String(err);
  breaker.lastFailureAt = Date.now();
  // falhas repetidas aumentam o cooldown (até 5 min)
  breaker.openUntil = Date.now() + Math.min(COOLDOWN_MS * breaker.failures, 300_000);
  global._mongoClientPromise = undefined;
  console.error(`[mongo] circuito aberto por ${Math.round((breaker.openUntil - Date.now()) / 1000)}s: ${breaker.lastError?.slice(0, 160)}`);
}

function closeCircuit() {
  breaker.openUntil = 0;
  breaker.failures = 0;
  breaker.lastError = null;
}

export function getClient(): Promise<MongoClient> {
  if (Date.now() < breaker.openUntil) {
    throw new DbUnavailableError(
      `MongoDB em cooldown (${Math.round((breaker.openUntil - Date.now()) / 1000)}s). Usando conteúdo de fallback.`,
    );
  }

  if (!global._mongoClientPromise) {
    const opts = {
      serverSelectionTimeoutMS: SERVER_SELECTION_MS,
      connectTimeoutMS: SERVER_SELECTION_MS,
      socketTimeoutMS: 15_000,
      maxPoolSize: 10,
      minPoolSize: 0,
      retryWrites: true,
      // evita travar procurando porta alternativa (importante em serverless)
      directConnection: false,
    };

    let uri: string;
    try {
      uri = buildUri();
    } catch (err) {
      openCircuit(err);
      throw new DbUnavailableError((err as Error).message);
    }

    const client = new MongoClient(uri, opts);
    global._mongoClientPromise = client.connect().then(
      (c) => {
        closeCircuit();
        return c;
      },
      (err) => {
        openCircuit(err);
        throw new DbUnavailableError((err as Error)?.message || String(err));
      },
    );
  }

  return global._mongoClientPromise;
}

/* ------------------------------------------------------------------ */
/* Índices (uma vez por processo)                                      */
/* ------------------------------------------------------------------ */

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(db: Db) {
  const col = db.collection("scripts");
  await Promise.all([
    col.createIndex({ slug: 1 }, { unique: true }),
    col.createIndex({ views: -1 }),
    col.createIndex({ likes: -1 }),
    col.createIndex({ createdAt: -1 }),
    col.createIndex({ category: 1 }),
    col.createIndex({ game: 1 }),
    col.createIndex(
      { title: "text", description: "text", tags: "text" },
      { name: "scripts_text", default_language: "none" },
    ),
  ]);
}

export async function getDb(): Promise<Db> {
  // Sem configuração de Mongo → modo local (arquivo), contados e site funcionais.
  if (!mongoConfigured()) {
    return getLocalDb() as unknown as Db;
  }

  const client = await getClient();
  const db = client.db(DB_NAME);
  if (!indexesReady) {
    indexesReady = ensureIndexes(db).catch((err) => {
      console.error("[mongo] falha ao criar índices:", err?.message || err);
    });
  }
  await indexesReady;
  return db;
}

/** Executa uma função que usa o banco; devolve `fallback` se o banco não estiver disponível. */
export async function withDb<T>(fn: (db: Db) => Promise<T>, fallback: T): Promise<T> {
  try {
    const db = await getDb();
    return await fn(db);
  } catch (err: any) {
    if (!(err instanceof DbUnavailableError)) {
      console.error("[mongo] consulta falhou:", err?.message || err);
    }
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                         */
/* ------------------------------------------------------------------ */

export type HealthInfo = {
  ok: boolean;
  db: string;
  mode: "srv" | "uri" | "hosts" | "local" | "ausente";
  latencyMs?: number;
  scripts?: number;
  error?: string;
  hint?: string;
  circuito?: ReturnType<typeof dbState>;
};

function modeOf(): HealthInfo["mode"] {
  if (!mongoConfigured()) return "local";
  if (process.env.MONGODB_URI?.includes("+srv")) return "srv";
  if (process.env.MONGODB_URI) return "uri";
  if (process.env.MONGODB_HOSTS) return "hosts";
  if (process.env.MONGODB_HOST) return "srv";
  return "ausente";
}

function hintFor(message: string) {
  if (/bad auth|Authentication failed/i.test(message)) {
    return "Usuário/senha inválidos: redefina a senha em Atlas → Database Access e atualize MONGODB_URI (.env.local e Vercel).";
  }
  if (/cooldown/i.test(message)) {
    return "O banco falhou e o site está em modo rápido (fallback). Ele tenta reconectar automaticamente após o cooldown.";
  }
  if (/timed out|ETIMEDOUT|ECONNREFUSED|querySrv|ENOTFOUND|alert internal error/i.test(message)) {
    return "Sem acesso ao cluster: libere 0.0.0.0/0 em Atlas → Network Access e confirme o hostname do cluster.";
  }
  return "Confira as variáveis de ambiente (MONGODB_URI) e o whitelist de IP no Atlas.";
}

/** `force` ignora o circuito e tenta conectar de verdade (usado em /api/health?debug=1) */
export async function pingDb(force = false): Promise<HealthInfo> {
  if (force) closeCircuit();

  const t0 = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const scripts = await db.collection("scripts").countDocuments().catch(() => undefined);
    return {
      ok: true,
      db: DB_NAME,
      mode: modeOf(),
      latencyMs: Date.now() - t0,
      scripts,
      circuito: dbState(),
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    return {
      ok: false,
      db: DB_NAME,
      mode: modeOf(),
      latencyMs: Date.now() - t0,
      error: message,
      hint: hintFor(message),
      circuito: dbState(),
    };
  }
}

export async function diagnose() {
  const info = await pingDb(true);
  const extra: Record<string, string> = {};

  if (!mongoConfigured()) {
    extra.modo = "local (sem banco): dados em data/local-db.json";
    return { ...info, extra };
  }

  try {
    const uri = buildUri();
    const host = uri.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "";
    extra.hostAlvo = host;
    if (uri.startsWith("mongodb+srv://")) {
      const dns = await import("node:dns/promises");
      const srv = await dns.resolveSrv(`_mongodb._tcp.${host}`);
      extra.srvResolvido = srv.map((s) => `${s.name}:${s.port}`).join(", ");
    }
  } catch (e: any) {
    extra.diagnostico = e?.code || e?.message || String(e);
  }
  return { ...info, extra };
}
