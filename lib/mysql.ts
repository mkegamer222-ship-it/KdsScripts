import { randomBytes } from "node:crypto";
import {
  createPool,
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { getLocalDb } from "./local-store";

type Doc = Record<string, any>;
type Direction = 1 | -1;
type Projection = Record<string, number | boolean>;
type Update = {
  $set?: Doc;
  $inc?: Record<string, number>;
  $unset?: Record<string, unknown>;
};

type TableSchema = {
  table: string;
  fields: string[];
  jsonFields: string[];
  booleanFields: string[];
  numberFields: string[];
  createTableSql: string;
};

const SCHEMAS: Record<string, TableSchema> = {
  users: {
    table: "users",
    fields: ["_id", "username", "displayName", "passwordHash", "salt", "role", "banned", "createdAt", "lastLoginAt"],
    jsonFields: [],
    booleanFields: ["banned"],
    numberFields: [],
    createTableSql: `CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` CHAR(24) NOT NULL,
      \`username\` VARCHAR(24) NOT NULL,
      \`displayName\` VARCHAR(40) NOT NULL,
      \`passwordHash\` CHAR(128) NOT NULL,
      \`salt\` CHAR(32) NOT NULL,
      \`role\` VARCHAR(10) NOT NULL DEFAULT 'user',
      \`banned\` TINYINT(1) NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL,
      \`lastLoginAt\` DATETIME(3) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_users_username\` (\`username\`),
      KEY \`idx_users_createdAt\` (\`createdAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  sessions: {
    table: "sessions",
    fields: ["_id", "token", "userId", "createdAt", "expiresAt"],
    jsonFields: [],
    booleanFields: [],
    numberFields: [],
    createTableSql: `CREATE TABLE IF NOT EXISTS \`sessions\` (
      \`id\` CHAR(24) NOT NULL,
      \`token\` CHAR(64) NOT NULL,
      \`userId\` CHAR(24) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL,
      \`expiresAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_sessions_token\` (\`token\`),
      KEY \`idx_sessions_expiresAt\` (\`expiresAt\`),
      KEY \`idx_sessions_userId\` (\`userId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  games: {
    table: "games",
    fields: [
      "_id", "placeId", "name", "universeId", "creator", "thumbnail", "status", "submittedBy",
      "reviewedBy", "reviewedAt", "reviewNote", "createdAt", "updatedAt",
    ],
    jsonFields: [],
    booleanFields: [],
    numberFields: ["placeId", "universeId"],
    createTableSql: `CREATE TABLE IF NOT EXISTS \`games\` (
      \`id\` CHAR(24) NOT NULL,
      \`placeId\` BIGINT UNSIGNED NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`universeId\` BIGINT UNSIGNED NULL,
      \`creator\` VARCHAR(191) NULL,
      \`thumbnail\` TEXT NULL,
      \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
      \`submittedBy\` VARCHAR(191) NULL,
      \`reviewedBy\` VARCHAR(191) NULL,
      \`reviewedAt\` DATETIME(3) NULL,
      \`reviewNote\` VARCHAR(300) NULL,
      \`createdAt\` DATETIME(3) NOT NULL,
      \`updatedAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_games_placeId\` (\`placeId\`),
      KEY \`idx_games_status_createdAt\` (\`status\`, \`createdAt\`),
      KEY \`idx_games_updatedAt\` (\`updatedAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  scripts: {
    table: "scripts",
    fields: [
      "_id", "slug", "title", "description", "code", "placeId", "gameName", "gameThumbnail", "tags",
      "features", "version", "keySystem", "status", "authorId", "authorName", "views", "likes", "copies",
      "reviewedBy", "reviewedAt", "reviewNote", "createdAt", "updatedAt",
    ],
    jsonFields: ["tags", "features"],
    booleanFields: ["keySystem"],
    numberFields: ["placeId", "views", "likes", "copies"],
    createTableSql: `CREATE TABLE IF NOT EXISTS \`scripts\` (
      \`id\` CHAR(24) NOT NULL,
      \`slug\` VARCHAR(100) NOT NULL,
      \`title\` VARCHAR(160) NOT NULL,
      \`description\` TEXT NOT NULL,
      \`code\` MEDIUMTEXT NOT NULL,
      \`placeId\` BIGINT UNSIGNED NOT NULL,
      \`gameName\` VARCHAR(191) NOT NULL,
      \`gameThumbnail\` TEXT NULL,
      \`tags\` LONGTEXT NOT NULL,
      \`features\` LONGTEXT NOT NULL,
      \`version\` VARCHAR(24) NOT NULL DEFAULT '1.0.0',
      \`keySystem\` TINYINT(1) NOT NULL DEFAULT 0,
      \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
      \`authorId\` CHAR(24) NULL,
      \`authorName\` VARCHAR(40) NOT NULL,
      \`views\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
      \`likes\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
      \`copies\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
      \`reviewedBy\` VARCHAR(40) NULL,
      \`reviewedAt\` DATETIME(3) NULL,
      \`reviewNote\` VARCHAR(300) NULL,
      \`createdAt\` DATETIME(3) NOT NULL,
      \`updatedAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_scripts_slug\` (\`slug\`),
      KEY \`idx_scripts_status_createdAt\` (\`status\`, \`createdAt\`),
      KEY \`idx_scripts_placeId_status\` (\`placeId\`, \`status\`),
      KEY \`idx_scripts_views\` (\`views\`),
      KEY \`idx_scripts_authorId\` (\`authorId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
};

type CollectionName = keyof typeof SCHEMAS;

export interface Database {
  collection<T extends Doc = Doc>(name: string): Collection<T>;
  command(command: Doc): Promise<Doc>;
}

export interface Collection<T extends Doc = Doc> {
  insertOne(doc: T): Promise<{ insertedId: string }>;
  findOne(filter?: Doc, options?: { projection?: Projection }): Promise<T | null>;
  find(filter?: Doc, options?: { projection?: Projection }): FindCursor<T>;
  countDocuments(filter?: Doc): Promise<number>;
  updateOne(filter: Doc, update: Update, options?: { upsert?: boolean }): Promise<{
    matchedCount: number;
    modifiedCount: number;
    upsertedId: string | null;
  }>;
  updateMany(filter: Doc, update: Update): Promise<{ matchedCount: number; modifiedCount: number }>;
  deleteOne(filter: Doc): Promise<{ deletedCount: number }>;
  deleteMany(filter?: Doc): Promise<{ deletedCount: number }>;
  createIndex(spec: Doc, options?: Doc): Promise<string>;
  aggregate(pipeline: Doc[]): AggregateCursor;
}

/* ------------------------------------------------------------------ */
/* Pool, schema creation and circuit breaker                          */
/* ------------------------------------------------------------------ */

type Breaker = {
  openUntil: number;
  lastError: string | null;
  lastFailureAt: number | null;
  failures: number;
};

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _mysqlPoolPromise: Promise<Pool> | undefined;
  // eslint-disable-next-line no-var
  var _mysqlBreaker: Breaker | undefined;
}

const CONNECT_TIMEOUT_MS = Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 8_000);
const COOLDOWN_MS = Number(process.env.MYSQL_COOLDOWN_MS || 15_000);
const DB_NAME = process.env.MYSQL_DATABASE?.trim() || "local";

const breaker: Breaker = (global._mysqlBreaker ??= {
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

export function mysqlConfigured(): boolean {
  return ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"].some((key) =>
    Boolean(process.env[key]?.trim()),
  );
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

function errorMessage(err: unknown): string {
  const raw = String((err as any)?.message || err || "Erro desconhecido");
  const secret = process.env.MYSQL_PASSWORD;
  return secret ? raw.split(secret).join("[oculto]").slice(0, 240) : raw.slice(0, 240);
}

function closeCircuit() {
  breaker.openUntil = 0;
  breaker.failures = 0;
  breaker.lastError = null;
}

function openCircuit(err: unknown) {
  breaker.failures += 1;
  breaker.lastError = errorMessage(err);
  breaker.lastFailureAt = Date.now();
  breaker.openUntil = Date.now() + Math.min(COOLDOWN_MS * breaker.failures, 300_000);

  const oldPool = global._mysqlPool;
  global._mysqlPool = undefined;
  global._mysqlPoolPromise = undefined;
  if (oldPool) void oldPool.end().catch(() => {});

  console.error(
    `[mysql] circuito aberto por ${Math.round((breaker.openUntil - Date.now()) / 1000)}s: ${breaker.lastError}`,
  );
}

function mysqlOptions() {
  const host = process.env.MYSQL_HOST?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD;
  const missing = [
    ["MYSQL_HOST", host],
    ["MYSQL_DATABASE", database],
    ["MYSQL_USER", user],
    ["MYSQL_PASSWORD", password],
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Configuração MySQL incompleta: faltam ${missing.join(", ")}.`);
  }

  const port = Number(process.env.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT precisa ser um número entre 1 e 65535.");
  }

  const requestedLimit = Number(process.env.MYSQL_CONNECTION_LIMIT || 2);
  const connectionLimit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(10, requestedLimit)) : 2;

  return {
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    connectTimeout: Math.max(1_000, CONNECT_TIMEOUT_MS),
    timezone: "Z" as const,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: false,
    enableKeepAlive: true,
  };
}

async function createSchema(connection: PoolConnection) {
  for (const schema of Object.values(SCHEMAS)) {
    await connection.query(schema.createTableSql);
  }
}

function getPool(): Promise<Pool> {
  if (Date.now() < breaker.openUntil) {
    throw new DbUnavailableError(
      `MySQL em cooldown (${Math.ceil((breaker.openUntil - Date.now()) / 1000)}s).`,
    );
  }

  if (!global._mysqlPoolPromise) {
    let options: ReturnType<typeof mysqlOptions>;
    try {
      options = mysqlOptions();
    } catch (err) {
      openCircuit(err);
      throw new DbUnavailableError(errorMessage(err));
    }

    const pool = createPool(options);
    global._mysqlPool = pool;
    global._mysqlPoolPromise = (async () => {
      let connection: PoolConnection | undefined;
      try {
        connection = await pool.getConnection();
        await connection.ping();
        await createSchema(connection);
        closeCircuit();
        return pool;
      } finally {
        connection?.release();
      }
    })().catch(async (err) => {
      openCircuit(err);
      await pool.end().catch(() => {});
      throw new DbUnavailableError(errorMessage(err));
    });
  }

  return global._mysqlPoolPromise;
}

function isConnectionFailure(err: any) {
  return [
    "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EPIPE",
    "PROTOCOL_CONNECTION_LOST", "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR", "ER_CON_COUNT_ERROR",
    "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR",
  ].includes(err?.code);
}

async function execute<T extends RowDataPacket[] | ResultSetHeader>(sql: string, values: unknown[] = []): Promise<T> {
  const pool = await getPool();
  try {
    const [result] = await pool.execute(sql, values as any[]);
    return result as T;
  } catch (err: any) {
    if (isConnectionFailure(err)) openCircuit(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* SQL helpers                                                         */
/* ------------------------------------------------------------------ */

function schemaFor(name: string): TableSchema {
  const schema = SCHEMAS[name];
  if (!schema) throw new Error(`Coleção SQL desconhecida: ${name}`);
  return schema;
}

function columnFor(schema: TableSchema, field: string): string {
  if (!schema.fields.includes(field)) throw new Error(`Campo SQL desconhecido: ${field}`);
  return field === "_id" ? "id" : field;
}

function quoteColumn(schema: TableSchema, field: string): string {
  return `\`${columnFor(schema, field)}\``;
}

function selectFields(schema: TableSchema, projection?: Projection): string[] {
  if (!projection) return [...schema.fields];
  const includeMode = Object.values(projection).some((value) => value === 1 || value === true);
  if (includeMode) {
    return schema.fields.filter((field) => {
      if (field === "_id") return projection._id !== 0 && projection._id !== false;
      return projection[field] === 1 || projection[field] === true;
    });
  }
  return schema.fields.filter((field) => projection[field] !== 0 && projection[field] !== false);
}

function sqlValue(schema: TableSchema, field: string, value: any) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (schema.jsonFields.includes(field)) return JSON.stringify(value);
  if (schema.booleanFields.includes(field)) return value ? 1 : 0;
  if (value instanceof Date) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function normalizeRow(schema: TableSchema, row: RowDataPacket): Doc {
  const doc: Doc = {};
  for (const field of schema.fields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    let value = row[field];
    if (value === null || value === undefined) {
      doc[field] = value;
      continue;
    }
    if (schema.jsonFields.includes(field)) {
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          value = [];
        }
      }
    } else if (schema.booleanFields.includes(field)) {
      value = Boolean(value);
    } else if (schema.numberFields.includes(field)) {
      value = Number(value);
    } else if (field === "_id") {
      value = String(value);
    }
    doc[field] = value;
  }
  return doc;
}

function compileFilter(schema: TableSchema, filter: Doc = {}): { sql: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  for (const [field, expected] of Object.entries(filter || {})) {
    if (field === "$or" || field === "$and") {
      const subfilters = Array.isArray(expected) ? expected : [];
      if (subfilters.length === 0) {
        clauses.push(field === "$or" ? "0 = 1" : "1 = 1");
        continue;
      }
      const compiled = subfilters.map((part) => compileFilter(schema, part));
      clauses.push(`(${compiled.map((part) => part.sql).join(field === "$or" ? " OR " : " AND ")})`);
      for (const part of compiled) values.push(...part.values);
      continue;
    }
    if (field.startsWith("$")) continue;

    const column = quoteColumn(schema, field);
    const operatorObject =
      expected !== null &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      !(expected instanceof Date) &&
      !(expected instanceof RegExp) &&
      Object.keys(expected).some((key) => key.startsWith("$"));

    if (expected instanceof RegExp) {
      clauses.push(regexSql(column, expected.source, expected.ignoreCase));
      values.push(expected.source);
      continue;
    }

    if (operatorObject) {
      const ops = expected as Doc;
      for (const [op, value] of Object.entries(ops)) {
        if (op === "$options") continue;
        if (op === "$regex") {
          const pattern = value instanceof RegExp ? value.source : String(value);
          clauses.push(regexSql(column, pattern, String(ops.$options || "").includes("i") || value instanceof RegExp && value.ignoreCase));
          values.push(pattern);
        } else if (op === "$in" || op === "$nin") {
          const list = Array.isArray(value) ? value : [];
          if (list.length === 0) {
            clauses.push(op === "$in" ? "0 = 1" : "1 = 1");
          } else {
            const placeholders = list.map(() => "?").join(", ");
            clauses.push(`${column} ${op === "$in" ? "IN" : "NOT IN"} (${placeholders})`);
            values.push(...list.map((item) => sqlValue(schema, field, item)));
          }
        } else if (op === "$ne") {
          if (value === null) clauses.push(`${column} IS NOT NULL`);
          else {
            clauses.push(`(${column} <> ? OR ${column} IS NULL)`);
            values.push(sqlValue(schema, field, value));
          }
        } else if (op === "$exists") {
          clauses.push(`${column} IS ${value ? "NOT " : ""}NULL`);
        } else if (["$gt", "$gte", "$lt", "$lte"].includes(op)) {
          const sign = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op] as string;
          clauses.push(`${column} ${sign} ?`);
          values.push(sqlValue(schema, field, value));
        }
      }
      continue;
    }

    if (expected === null || expected === undefined) {
      clauses.push(`${column} IS NULL`);
    } else if (schema.jsonFields.includes(field) && typeof expected === "string") {
      clauses.push(`JSON_CONTAINS(COALESCE(${column}, '[]'), JSON_QUOTE(?))`);
      values.push(expected);
    } else {
      clauses.push(`${column} = ?`);
      values.push(sqlValue(schema, field, expected));
    }
  }

  return { sql: clauses.length ? clauses.join(" AND ") : "1 = 1", values };
}

function regexSql(column: string, pattern: string, insensitive: boolean) {
  const left = `CAST(${column} AS CHAR)`;
  return insensitive ? `LOWER(${left}) REGEXP LOWER(?)` : `${left} REGEXP ?`;
}

function projectRow(schema: TableSchema, row: RowDataPacket, projection?: Projection): Doc {
  const doc = normalizeRow(schema, row);
  if (!projection) return doc;
  const includeMode = Object.values(projection).some((value) => value === 1 || value === true);
  const out: Doc = {};
  for (const [key, value] of Object.entries(doc)) {
    const wanted = includeMode
      ? key === "_id"
        ? projection._id !== 0 && projection._id !== false
        : projection[key] === 1 || projection[key] === true
      : projection[key] !== 0 && projection[key] !== false;
    if (wanted) out[key] = value;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Document-style collection facade over relational MySQL tables      */
/* ------------------------------------------------------------------ */

export class FindCursor<T extends Doc = Doc> {
  private sortSpec: Record<string, Direction> | null = null;
  private offset = 0;
  private rowLimit = Number.POSITIVE_INFINITY;

  constructor(
    private readonly collection: SqlCollection<T>,
    private readonly filter: Doc = {},
    private readonly projection?: Projection,
  ) {}

  sort(spec: Record<string, Direction> | Array<[string, Direction]> | string): this {
    if (typeof spec === "string") this.sortSpec = { [spec]: 1 };
    else if (Array.isArray(spec)) this.sortSpec = Object.fromEntries(spec) as Record<string, Direction>;
    else this.sortSpec = spec;
    return this;
  }

  skip(n: number): this {
    this.offset = Math.max(0, Number(n) || 0);
    return this;
  }

  limit(n: number): this {
    this.rowLimit = Math.max(0, Number(n) || 0);
    return this;
  }

  async toArray(): Promise<T[]> {
    return this.collection.queryMany(this.filter, this.projection, this.sortSpec, this.offset, this.rowLimit);
  }
}

export class AggregateCursor {
  constructor(private readonly collection: SqlCollection, private readonly pipeline: Doc[]) {}

  async toArray(): Promise<Doc[]> {
    const firstMatch = this.pipeline.find((stage) => stage.$match)?.$match as Doc | undefined;
    const selected = new Set<string>();
    if (firstMatch) collectFilterFields(firstMatch, selected);

    for (const stage of this.pipeline) {
      if (!stage.$group) continue;
      const group = stage.$group as Doc;
      if (typeof group._id === "string" && group._id.startsWith("$")) selected.add(group._id.slice(1));
      for (const accumulator of Object.values(group)) {
        const expression = accumulator as Doc;
        if (typeof expression?.$sum === "string" && expression.$sum.startsWith("$")) {
          selected.add(expression.$sum.slice(1));
        }
      }
    }

    const projection: Projection = Object.fromEntries([...selected].map((field) => [field, 1]));
    projection._id = 0;
    let docs = await this.collection.find(firstMatch || {}, { projection }).toArray();
    let consumedFirstMatch = false;

    for (const stage of this.pipeline) {
      if (stage.$match) {
        if (!consumedFirstMatch && stage.$match === firstMatch) {
          consumedFirstMatch = true;
          continue;
        }
        docs = docs.filter((doc) => matchesDocument(doc, stage.$match));
      } else if (stage.$group) {
        docs = groupDocuments(docs, stage.$group);
      } else if (stage.$sort) {
        docs = sortDocuments(docs, stage.$sort);
      } else if (stage.$limit) {
        docs = docs.slice(0, Number(stage.$limit));
      }
    }

    return docs;
  }
}

export class SqlCollection<T extends Doc = Doc> implements Collection<T> {
  private readonly schema: TableSchema;

  constructor(readonly name: CollectionName) {
    this.schema = schemaFor(name);
  }

  async insertOne(doc: T): Promise<{ insertedId: string }> {
    const id = String(doc._id ?? randomBytes(12).toString("hex"));
    const toInsert = { ...doc, _id: id } as Doc;
    const fields = this.schema.fields.filter((field) => toInsert[field] !== undefined);
    const columns = fields.map((field) => `\`${columnFor(this.schema, field)}\``);
    const placeholders = fields.map(() => "?").join(", ");
    const values = fields.map((field) => sqlValue(this.schema, field, toInsert[field]));
    await execute<ResultSetHeader>(
      `INSERT INTO \`${this.schema.table}\` (${columns.join(", ")}) VALUES (${placeholders})`,
      values,
    );
    return { insertedId: id };
  }

  async findOne(filter: Doc = {}, options: { projection?: Projection } = {}): Promise<T | null> {
    const rows = await this.queryRows(filter, options.projection, undefined, 0, 1);
    return rows[0] ? (projectRow(this.schema, rows[0], options.projection) as T) : null;
  }

  find(filter: Doc = {}, options: { projection?: Projection } = {}): FindCursor<T> {
    return new FindCursor(this, filter, options.projection);
  }

  async countDocuments(filter: Doc = {}): Promise<number> {
    const where = compileFilter(this.schema, filter);
    const rows = await execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS \`count\` FROM \`${this.schema.table}\` WHERE ${where.sql}`,
      where.values,
    );
    return Number(rows[0]?.count || 0);
  }

  async updateOne(
    filter: Doc,
    update: Update,
    options: { upsert?: boolean } = {},
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId: string | null }> {
    const assignments = compileUpdate(this.schema, update);
    if (assignments.sql.length === 0) {
      const existing = await this.findOne(filter, { projection: { _id: 1 } });
      if (existing) return { matchedCount: 1, modifiedCount: 0, upsertedId: null };
      if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedId: null };
      return this.insertUpsert(filter, update);
    }

    const where = compileFilter(this.schema, filter);
    const result = await execute<ResultSetHeader>(
      `UPDATE \`${this.schema.table}\` SET ${assignments.sql.join(", ")} WHERE ${where.sql} LIMIT 1`,
      [...assignments.values, ...where.values],
    );

    if (result.affectedRows > 0) {
      return { matchedCount: 1, modifiedCount: 1, upsertedId: null };
    }

    const existing = await this.findOne(filter, { projection: { _id: 1 } });
    if (existing) return { matchedCount: 1, modifiedCount: 0, upsertedId: null };
    if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedId: null };

    return this.insertUpsert(filter, update);
  }

  async updateMany(filter: Doc, update: Update): Promise<{ matchedCount: number; modifiedCount: number }> {
    const assignments = compileUpdate(this.schema, update);
    if (assignments.sql.length === 0) return { matchedCount: 0, modifiedCount: 0 };
    const where = compileFilter(this.schema, filter);
    const result = await execute<ResultSetHeader>(
      `UPDATE \`${this.schema.table}\` SET ${assignments.sql.join(", ")} WHERE ${where.sql}`,
      [...assignments.values, ...where.values],
    );
    return { matchedCount: result.affectedRows, modifiedCount: result.affectedRows };
  }

  async deleteOne(filter: Doc): Promise<{ deletedCount: number }> {
    const where = compileFilter(this.schema, filter);
    const result = await execute<ResultSetHeader>(
      `DELETE FROM \`${this.schema.table}\` WHERE ${where.sql} LIMIT 1`,
      where.values,
    );
    return { deletedCount: result.affectedRows };
  }

  async deleteMany(filter: Doc = {}): Promise<{ deletedCount: number }> {
    const where = compileFilter(this.schema, filter);
    const result = await execute<ResultSetHeader>(
      `DELETE FROM \`${this.schema.table}\` WHERE ${where.sql}`,
      where.values,
    );
    return { deletedCount: result.affectedRows };
  }

  /** Os índices equivalentes são declarados no esquema MySQL e criados no primeiro acesso. */
  async createIndex(spec: Doc): Promise<string> {
    return `${this.schema.table}_${Object.keys(spec).join("_")}_idx`;
  }

  aggregate(pipeline: Doc[]): AggregateCursor {
    return new AggregateCursor(this, pipeline);
  }

  async queryMany(
    filter: Doc,
    projection?: Projection,
    sort?: Record<string, Direction> | null,
    skip = 0,
    limit = Number.POSITIVE_INFINITY,
  ): Promise<T[]> {
    const rows = await this.queryRows(filter, projection, sort, skip, limit);
    return rows.map((row) => projectRow(this.schema, row, projection) as T);
  }

  private async queryRows(
    filter: Doc,
    projection?: Projection,
    sort?: Record<string, Direction> | null,
    skip = 0,
    limit = Number.POSITIVE_INFINITY,
  ): Promise<RowDataPacket[]> {
    const where = compileFilter(this.schema, filter);
    const selected = selectFields(this.schema, projection);
    if (selected.length === 0) selected.push("_id");

    const columns = selected.map((field) => {
      const column = columnFor(this.schema, field);
      return field === "_id" ? `\`${column}\` AS \`_id\`` : `\`${column}\``;
    });
    let sql = `SELECT ${columns.join(", ")} FROM \`${this.schema.table}\` WHERE ${where.sql}`;
    const values = [...where.values];

    if (sort && Object.keys(sort).length) {
      const order = Object.entries(sort).map(([field, direction]) => {
        return `${quoteColumn(this.schema, field)} ${direction < 0 ? "DESC" : "ASC"}`;
      });
      sql += ` ORDER BY ${order.join(", ")}`;
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : null;
    const safeOffset = Math.max(0, Math.floor(skip || 0));
    if (safeLimit !== null) {
      sql += " LIMIT ?";
      values.push(safeLimit);
      if (safeOffset) {
        sql += " OFFSET ?";
        values.push(safeOffset);
      }
    } else if (safeOffset) {
      sql += " LIMIT 18446744073709551615 OFFSET ?";
      values.push(safeOffset);
    }

    return execute<RowDataPacket[]>(sql, values);
  }

  private async insertUpsert(filter: Doc, update: Update) {
    const doc: Doc = {};
    for (const [field, value] of Object.entries(filter || {})) {
      if (field.startsWith("$")) continue;
      if (value === null || value === undefined || value instanceof RegExp) continue;
      if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) continue;
      doc[field] = value;
    }
    Object.assign(doc, update.$set || {});
    for (const [field, amount] of Object.entries(update.$inc || {})) {
      doc[field] = Number(doc[field] || 0) + Number(amount);
    }

    try {
      const result = await this.insertOne(doc as T);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: result.insertedId };
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY") {
        const existing = await this.findOne(filter, { projection: { _id: 1 } });
        if (existing) return this.updateOne(filter, update, { upsert: false });
      }
      throw err;
    }
  }
}

function compileUpdate(schema: TableSchema, update: Update) {
  const sql: string[] = [];
  const values: unknown[] = [];

  for (const [field, value] of Object.entries(update.$set || {})) {
    if (value === undefined) continue;
    const column = quoteColumn(schema, field);
    sql.push(`${column} = ?`);
    values.push(sqlValue(schema, field, value));
  }
  for (const [field, value] of Object.entries(update.$inc || {})) {
    const column = quoteColumn(schema, field);
    sql.push(`${column} = COALESCE(${column}, 0) + ?`);
    values.push(Number(value));
  }
  for (const field of Object.keys(update.$unset || {})) {
    const column = quoteColumn(schema, field);
    sql.push(`${column} = NULL`);
  }

  return { sql, values };
}

function collectFilterFields(filter: Doc, fields: Set<string>) {
  for (const [field, value] of Object.entries(filter || {})) {
    if (field === "$or" || field === "$and") {
      for (const item of Array.isArray(value) ? value : []) collectFilterFields(item, fields);
    } else if (!field.startsWith("$")) {
      fields.add(field);
    }
  }
}

function matchesDocument(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter || {}).every(([field, expected]) => {
    if (field === "$or") return (expected as Doc[]).some((item) => matchesDocument(doc, item));
    if (field === "$and") return (expected as Doc[]).every((item) => matchesDocument(doc, item));
    if (field.startsWith("$")) return true;

    const actual = doc[field];
    if (expected instanceof RegExp) return typeof actual === "string" && expected.test(actual);
    if (expected === null || expected === undefined) return actual == null;
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      return Object.entries(expected as Doc).every(([op, value]: [string, any]) => {
        if (op === "$in") return (value as any[]).some((item) => matchesDocument({ value: actual }, { value: item }));
        if (op === "$ne") return actual !== value;
        if (op === "$gt") return actual > value;
        if (op === "$gte") return actual >= value;
        if (op === "$lt") return actual < value;
        if (op === "$lte") return actual <= value;
        return true;
      });
    }
    if (Array.isArray(actual)) return actual.includes(expected);
    return actual === expected || (typeof actual === "number" && Number(actual) === Number(expected));
  });
}

function groupDocuments(docs: Doc[], group: Doc): Doc[] {
  const groups = new Map<string, Doc>();
  for (const doc of docs) {
    const rawKey = typeof group._id === "string" && group._id.startsWith("$") ? doc[group._id.slice(1)] : group._id;
    const key = rawKey === null || rawKey === undefined ? "__null__" : JSON.stringify(rawKey);
    let output = groups.get(key);
    if (!output) {
      output = { _id: rawKey ?? null };
      groups.set(key, output);
    }
    for (const [name, expression] of Object.entries(group)) {
      if (name === "_id") continue;
      const sum = (expression as Doc)?.$sum;
      const amount = typeof sum === "string" && sum.startsWith("$") ? Number(doc[sum.slice(1)]) || 0 : Number(sum) || 0;
      output[name] = (Number(output[name]) || 0) + amount;
    }
  }
  return [...groups.values()];
}

function sortDocuments(docs: Doc[], spec: Doc): Doc[] {
  const entries = Object.entries(spec) as [string, Direction][];
  return docs.sort((a, b) => {
    for (const [field, direction] of entries) {
      const left = a[field];
      const right = b[field];
      if (left === right) continue;
      if (left === undefined || left === null) return 1;
      if (right === undefined || right === null) return -1;
      return (left > right ? 1 : -1) * direction;
    }
    return 0;
  });
}

/* ------------------------------------------------------------------ */
/* Database facade and diagnostics                                    */
/* ------------------------------------------------------------------ */

class MySqlDatabase implements Database {
  collection<T extends Doc = Doc>(name: string): SqlCollection<T> {
    if (!Object.prototype.hasOwnProperty.call(SCHEMAS, name)) throw new Error(`Coleção SQL desconhecida: ${name}`);
    return new SqlCollection<T>(name as CollectionName);
  }

  async command(command: Doc = {}) {
    if (command.ping) {
      await execute<RowDataPacket[]>("SELECT 1 AS `ok`");
      return { ok: 1 };
    }
    return { ok: 1 };
  }
}

const mysqlDatabase = new MySqlDatabase();

export async function getDb(): Promise<Database> {
  if (!mysqlConfigured()) return getLocalDb() as unknown as Database;
  await getPool();
  return mysqlDatabase;
}

export async function withDb<T>(fn: (db: Database) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn(await getDb());
  } catch (err: any) {
    if (!(err instanceof DbUnavailableError)) {
      console.error("[mysql] consulta falhou:", errorMessage(err));
    }
    return fallback;
  }
}

export type HealthInfo = {
  ok: boolean;
  db: string;
  mode: "mysql" | "local" | "ausente";
  latencyMs?: number;
  scripts?: number;
  error?: string;
  hint?: string;
  circuito?: ReturnType<typeof dbState>;
};

function modeOf(): HealthInfo["mode"] {
  return mysqlConfigured() ? "mysql" : "local";
}

function hintFor(message: string) {
  if (/ER_ACCESS_DENIED_ERROR|access denied|authentication/i.test(message)) {
    return "Acesso MySQL negado. Confira MYSQL_USER e MYSQL_PASSWORD no painel do provedor.";
  }
  if (/ER_BAD_DB_ERROR|unknown database/i.test(message)) {
    return "O banco não existe ou o usuário não tem permissão. Confira MYSQL_DATABASE no painel do provedor.";
  }
  if (/cooldown/i.test(message)) {
    return "A conexão falhou e o circuito está em espera; uma nova tentativa ocorrerá após o intervalo configurado.";
  }
  if (/timed out|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ENOTFOUND/i.test(message)) {
    return "O servidor MySQL não está acessível a partir desta hospedagem. Verifique o host, a porta e se conexões externas são permitidas.";
  }
  return "Confira MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD.";
}

/** Testa a conexão e devolve detalhes seguros para a tela interna de saúde. */
export async function pingDb(force = false): Promise<HealthInfo> {
  if (force) closeCircuit();
  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const scripts = await db.collection("scripts").countDocuments().catch(() => undefined);
    return {
      ok: true,
      db: DB_NAME,
      mode: modeOf(),
      latencyMs: Date.now() - startedAt,
      scripts,
      circuito: dbState(),
    };
  } catch (err: any) {
    const message = errorMessage(err);
    return {
      ok: false,
      db: DB_NAME,
      mode: modeOf(),
      latencyMs: Date.now() - startedAt,
      error: message,
      hint: hintFor(message),
      circuito: dbState(),
    };
  }
}

export async function diagnose() {
  const info = await pingDb(true);
  const extra: Record<string, string> = {};
  if (!mysqlConfigured()) {
    extra.modo = "local (sem banco): dados em data/local-db.json";
  } else {
    extra.host = process.env.MYSQL_HOST || "";
    extra.porta = process.env.MYSQL_PORT || "3306";
    extra.bancoConfigurado = process.env.MYSQL_DATABASE ? "sim" : "não";
    extra.usuarioConfigurado = process.env.MYSQL_USER ? "sim" : "não";
    extra.senhaConfigurada = process.env.MYSQL_PASSWORD ? "sim" : "não";
  }
  return { ...info, extra };
}
