/**
 * Diagnóstico da conexão com o MongoDB.
 *   npm run check
 *
 * Testa, em ordem: variáveis de ambiente → DNS/SRV → TLS → autenticação,
 * e diz exatamente o que corrigir.
 */
import { readFileSync, existsSync } from "node:fs";
import dns from "node:dns/promises";
import tls from "node:tls";
import { MongoClient } from "mongodb";

function loadEnv() {
  // Mesma precedência do Next.js: process.env real > .env.local > .env.
  // Valor vazio em .env.local conta como DEFINIDO (desativa a variável),
  // como no @next/env — antes o !process.env[k] deixava o .env sobrescrever.
  const deArquivo = new Set();
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (deArquivo.has(m[1]) || !(m[1] in process.env)) {
        process.env[m[1]] = v;
        deArquivo.add(m[1]);
      }
    }
  }
}
loadEnv();

const ok = (m) => console.log("  \x1b[32m✔\x1b[0m " + m);
const bad = (m) => console.log("  \x1b[31m✘\x1b[0m " + m);
const warn = (m) => console.log("  \x1b[33m!\x1b[0m " + m);

// Mesma limpeza de lib/mongodb.ts: tira colchetes / "](mailto:...)" da URI colada.
const raw = (process.env.MONGODB_URI || "").replace(/\]\([^)]*\)/g, "").replace(/[\[\]]/g, "").trim();
const dbName = process.env.MONGODB_DB || "kdss";

console.log("\n=== KDS Scripts · diagnóstico do banco ===\n");

console.log("1) Variáveis de ambiente");
if (raw) {
  ok("MONGODB_URI definida: " + raw.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@"));
  if (raw.startsWith("mongodb+srv://")) ok("modo SRV");
  else warn("URI sem +srv — normal se for banco local");
} else {
  bad("MONGODB_URI não definida (copie .env.example para .env.local)");
}
console.log("   banco: " + dbName);
console.log(
  "   conta de staff: " +
    (process.env.STAFF_USERNAME
      ? process.env.STAFF_USERNAME + (process.env.STAFF_PASSWORD ? " (senha definida)" : " (SEM SENHA)")
      : "não definida — nenhuma conta de staff será criada"),
);

let hosts = [];
if (raw.startsWith("mongodb+srv://")) {
  const host = raw.split("@")[1]?.split("/")[0]?.split("?")[0];
  console.log("\n2) DNS");
  try {
    const srv = await dns.resolveSrv(`_mongodb._tcp.${host}`);
    hosts = srv.map((s) => ({ name: s.name, port: s.port }));
    ok(`SRV ok — ${srv.length} hosts`);
    for (const s of srv) {
      try {
        const [ip] = await dns.resolve4(s.name);
        ok(`  ${s.name} → ${ip}`);
      } catch (e) {
        bad(`  ${s.name} não resolveu (${e.code})`);
      }
    }
  } catch (e) {
    bad(`SRV falhou para ${host}: ${e.code}`);
    if (e.code === "ENOTFOUND") {
      warn("O hostname do cluster pode ter mudado ou o cluster está pausado.");
    }
  }

  if (hosts[0]) {
    console.log("\n3) TLS");
    await new Promise((resolve) => {
      const so = tls.connect(
        { host: hosts[0].name, port: hosts[0].port, servername: hosts[0].name, timeout: 12000 },
        () => {
          ok("handshake TLS ok");
          so.end();
          resolve();
        },
      );
      so.on("error", (e) => {
        bad("TLS falhou: " + e.message);
        warn("No Atlas, verifique Security → Network Access.");
        resolve();
      });
      so.on("timeout", () => {
        bad("timeout no TLS");
        so.destroy();
        resolve();
      });
    });
  }
}

console.log("\n4) Autenticação");
if (!raw) {
  warn("sem MONGODB_URI — o site roda em MODO LOCAL (dados em data/local-db.json).");
  console.log("   Defina MONGODB_URI para usar o MongoDB (Atlas) em produção.\n");
  process.exitCode = 0;
  process.exit(0);
} else {
  const client = new MongoClient(raw, { serverSelectionTimeoutMS: 15000 });
  try {
    const t0 = Date.now();
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    ok(`conectado e autenticado em ${Date.now() - t0}ms`);
    for (const col of ["users", "scripts", "games", "sessions"]) {
      const n = await db.collection(col).countDocuments();
      console.log(`   ${col}: ${n} documento(s)`);
    }
    const owner = await db.collection("users").findOne({ role: "owner" });
    if (owner) ok(`conta de staff ativa: ${owner.displayName || owner.username}`);
    else warn("Nenhuma conta de staff ainda — ela é criada no primeiro boot do site.");
  } catch (e) {
    const msg = String(e.message);
    bad(msg.slice(0, 200));
    if (/bad auth/i.test(msg)) {
      console.log("\n  \x1b[33mCOMO RESOLVER 'bad auth' →\x1b[0m");
      console.log("   1. Atlas → Database Access → edite o usuário → Edit Password → Autogenerate.");
      console.log("      Atualize MONGODB_URI no .env.local E nas variáveis da hospedagem.");
      console.log("   2. Confira se o usuário é exatamente o que aparece no Atlas.");
      console.log("   3. Se a senha tiver @ : / ? # & % — use encodeURIComponent nela.");
    } else if (/timed out|ETIMEDOUT|querySrv|alert internal error/i.test(msg)) {
      console.log("\n  \x1b[33mCOMO RESOLVER timeout/acesso →\x1b[0m");
      console.log("   Atlas → Security → Network Access → Add IP → 0.0.0.0/0 (Allow from anywhere).");
    }
  } finally {
    await client.close().catch(() => {});
  }
}

console.log("\n=== fim do diagnóstico ===\n");
process.exitCode = 0;
