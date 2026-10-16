/**
 * Diagnóstico da conexão com MySQL.
 *   npm run check
 *
 * Lê as variáveis MYSQL_*, testa a conexão e informa se as tabelas já existem.
 * As tabelas são criadas automaticamente pelo app na primeira inicialização.
 */
import { readFileSync, existsSync } from "node:fs";
import { createConnection } from "mysql2/promise";

function loadEnv() {
  // Ambiente do processo > .env.local > .env.
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const ok = (message) => console.log("  \x1b[32m✔\x1b[0m " + message);
const bad = (message) => console.log("  \x1b[31m✘\x1b[0m " + message);
const warn = (message) => console.log("  \x1b[33m!\x1b[0m " + message);

const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"];
const missing = required.filter((key) => !process.env[key]?.trim());

console.log("\n=== KDS Scripts · diagnóstico MySQL ===\n");
console.log("1) Variáveis de ambiente");

if (missing.length === required.length) {
  warn("MySQL não configurado; o site está em modo local (data/local-db.json).");
  console.log("   Defina MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD para usar MySQL.\n");
  process.exit(0);
}

if (missing.length) {
  bad("Configuração incompleta. Variáveis ausentes: " + missing.join(", "));
  process.exit(1);
}

const host = process.env.MYSQL_HOST.trim();
const port = Number(process.env.MYSQL_PORT || 3306);
const database = process.env.MYSQL_DATABASE.trim();
const user = process.env.MYSQL_USER.trim();
const password = process.env.MYSQL_PASSWORD;
const connectTimeout = Math.max(1_000, Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 8_000));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  bad("MYSQL_PORT precisa ser um número entre 1 e 65535.");
  process.exit(1);
}

ok(`host: ${host}:${port}`);
ok(`banco: ${database}`);
ok("usuário e senha definidos (os valores da senha não são exibidos)");
console.log(
  "   conta inicial de staff: " +
    (process.env.STAFF_USERNAME
      ? `${process.env.STAFF_USERNAME}${process.env.STAFF_PASSWORD ? " (senha definida)" : " (SEM SENHA)"}`
      : "não definida — nenhuma conta de staff será criada"),
);

console.log("\n2) Conexão e autenticação");
let connection;
try {
  connection = await createConnection({
    host,
    port,
    database,
    user,
    password,
    connectTimeout,
    timezone: "Z",
    charset: "utf8mb4",
  });
  await connection.ping();
  ok("conectado e autenticado");

  const [tableRows] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'sessions', 'scripts', 'games')",
    [database],
  );
  const tables = new Set(tableRows.map((row) => row.TABLE_NAME));
  if (tables.size === 0) {
    warn("As tabelas ainda não existem; o app vai criá-las no primeiro acesso.");
  } else {
    ok(`tabelas encontradas: ${[...tables].join(", ")}`);
    for (const table of ["users", "sessions", "scripts", "games"]) {
      if (!tables.has(table)) {
        console.log(`   ${table}: ainda não criada`);
        continue;
      }
      const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      console.log(`   ${table}: ${Number(rows[0]?.total || 0)} registro(s)`);
    }

    if (tables.has("users")) {
      const [owners] = await connection.query(
        "SELECT displayName, username FROM `users` WHERE role = 'owner' LIMIT 1",
      );
      if (owners[0]) ok(`conta de staff encontrada: ${owners[0].displayName || owners[0].username}`);
      else warn("Nenhuma conta de staff; ela será criada no primeiro boot do site.");
    }
  }
} catch (error) {
  const code = error?.code || "";
  let message = String(error?.message || error);
  if (password) message = message.split(password).join("[oculto]");
  bad(`${code ? `${code}: ` : ""}${message.slice(0, 220)}`);

  if (code === "ER_ACCESS_DENIED_ERROR") {
    console.log("\n  Confira MYSQL_USER, MYSQL_PASSWORD e se o usuário tem acesso ao banco informado.");
  } else if (code === "ER_BAD_DB_ERROR") {
    console.log("\n  Confira MYSQL_DATABASE e crie o banco no painel do provedor, se necessário.");
  } else if (["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND"].includes(code)) {
    console.log("\n  O host/porta não está acessível. Alguns provedores gratuitos bloqueiam conexões MySQL externas; teste a partir da hospedagem onde o app vai rodar.");
  }
  process.exitCode = 1;
} finally {
  await connection?.end().catch(() => {});
}

console.log("\n=== fim do diagnóstico ===\n");
