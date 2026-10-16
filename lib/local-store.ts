/**
 * Armazenamento local em arquivo (JSON) — "modo sem banco".
 *
 * Ativa automaticamente quando as variáveis MYSQL_* não estão definidas.
 * Implementa o subconjunto das operações de dados usadas pelo projeto, para o site
 * funcionar completo (contas, sessões, scripts, jogos) sem servidor externo:
 * ideal para desenvolvimento local e ambientes sem rede ao banco.
 *
 * Com a configuração MySQL definida, este arquivo não é usado — o MySQL é a fonte.
 * Os dados persistem em `data/local-db.json`.
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Doc = Record<string, any>;

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "local-db.json");

let db: Record<string, Doc[]> | null = null;

function load(): Record<string, Doc[]> {
  if (db) return db;
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8"));
      if (parsed && typeof parsed === "object") db = parsed;
    }
  } catch (err) {
    console.error("[local-db] falha ao ler o arquivo, iniciando vazio:", err);
  }
  if (!db) db = {};
  return db;
}

function save() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(db ?? {}), "utf8");
  } catch (err) {
    console.error("[local-db] falha ao gravar:", err);
  }
}

function newId(): string {
  return randomBytes(12).toString("hex");
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

/** Normaliza IDs que ofereçam toHexString para comparação com os IDs gravados. */
function idOf(value: any): any {
  if (value && typeof value === "object" && typeof value.toHexString === "function") {
    return value.toHexString();
  }
  return value;
}

function isOperatorObject(value: any): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof RegExp) &&
    Object.keys(value).some((k) => k.startsWith("$"))
  );
}

function matchOperators(actual: any, ops: Record<string, any>): boolean {
  return Object.entries(ops).every(([op, val]) => {
    switch (op) {
      case "$in":
        return (val as any[]).some((v) => matchScalar(actual, v));
      case "$nin":
        return !(val as any[]).some((v) => matchScalar(actual, v));
      case "$ne":
        return !matchScalar(actual, val);
      case "$gt":
        return actual > val;
      case "$gte":
        return actual >= val;
      case "$lt":
        return actual < val;
      case "$lte":
        return actual <= val;
      case "$exists":
        return val ? actual !== undefined : actual === undefined;
      case "$regex": {
        const re = val instanceof RegExp ? val : new RegExp(String(val), ops.$options || "");
        return typeof actual === "string" && re.test(actual);
      }
      case "$options":
        return true; // consumido pelo $regex
      default:
        return true;
    }
  });
}

function matchScalar(actual: any, expected: any): boolean {
  const a = idOf(actual);
  const e = idOf(expected);

  if (e instanceof RegExp) return typeof a === "string" && e.test(a);
  if (isOperatorObject(e)) return matchOperators(a, e);
  if (typeof a === "number" && typeof e === "string" && e.trim() !== "") {
    return Number(e) === a;
  }
  if (typeof a === "string" && typeof e === "number") {
    return Number(a) === e;
  }
  return a === e;
}

function matches(doc: Doc, filter: Doc): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return (value as Doc[]).some((sub) => matches(doc, sub));
    if (key === "$and") return (value as Doc[]).every((sub) => matches(doc, sub));
    if (key.startsWith("$")) return true; // operadores não usados são ignorados
    if (value === null || value === undefined) return doc[key] == null;
    return matchScalar(doc[key], value);
  });
}

/* ------------------------------------------------------------------ */
/* Projeção                                                            */
/* ------------------------------------------------------------------ */

function applyProjection(doc: Doc, projection?: Record<string, any>): Doc {
  if (!projection) return { ...doc };
  const includeMode = Object.values(projection).some((v) => v === 1 || v === true);
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
/* Updates                                                             */
/* ------------------------------------------------------------------ */

function applyUpdate(doc: Doc, update: Doc) {
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      if (v !== undefined) doc[k] = v;
    }
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      doc[k] = (Number(doc[k]) || 0) + Number(v);
    }
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) delete doc[k];
  }
}

/* ------------------------------------------------------------------ */
/* Coleção                                                             */
/* ------------------------------------------------------------------ */

class FindCursor {
  private _sort: Record<string, 1 | -1> | null = null;
  private _skip = 0;
  private _limit = Infinity;

  constructor(
    private docs: Doc[],
    private projection?: Record<string, any>,
  ) {}

  sort(spec: Record<string, 1 | -1> | Array<[string, 1 | -1]> | string): this {
    if (typeof spec === "string") this._sort = { [spec]: 1 };
    else if (Array.isArray(spec)) this._sort = Object.fromEntries(spec);
    else this._sort = spec;
    return this;
  }

  skip(n: number): this {
    this._skip = n;
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  async toArray(): Promise<Doc[]> {
    let arr = [...this.docs];

    if (this._sort) {
      const keys = Object.entries(this._sort);
      arr.sort((a, b) => {
        for (const [k, dir] of keys) {
          const va = a[k];
          const vb = b[k];
          if (va === vb) continue;
          if (va === undefined || va === null) return 1;
          if (vb === undefined || vb === null) return -1;
          return (va > vb ? 1 : -1) * dir;
        }
        return 0;
      });
    }

    if (this._skip) arr = arr.slice(this._skip);
    if (this._limit !== Infinity) arr = arr.slice(0, this._limit);

    return arr.map((d) => clone(applyProjection(d, this.projection)));
  }
}

export class LocalCollection {
  constructor(readonly name: string) {}

  private col(): Doc[] {
    const data = load();
    if (!data[this.name]) data[this.name] = [];
    return data[this.name];
  }

  async insertOne(doc: Doc): Promise<{ insertedId: string }> {
    const stored: Doc = { ...doc };
    if (stored._id === undefined) stored._id = newId();
    this.col().push(stored);
    save();
    return { insertedId: stored._id };
  }

  async insertMany(docs: Doc[]): Promise<{ insertedIds: string[] }> {
    const ids: string[] = [];
    for (const d of docs) ids.push((await this.insertOne(d)).insertedId);
    return { insertedIds: ids };
  }

  async findOne(filter: Doc = {}, options: { projection?: Record<string, any> } = {}): Promise<Doc | null> {
    const found = this.col().find((d) => matches(d, filter));
    return found ? clone(applyProjection(found, options.projection)) : null;
  }

  find(filter: Doc = {}, options: { projection?: Record<string, any> } = {}): FindCursor {
    const docs = this.col().filter((d) => matches(d, filter));
    return new FindCursor(docs, options.projection);
  }

  async countDocuments(filter: Doc = {}): Promise<number> {
    return this.col().filter((d) => matches(d, filter)).length;
  }

  async updateOne(
    filter: Doc,
    update: Doc,
    options: { upsert?: boolean } = {},
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId: string | null }> {
    const col = this.col();
    const idx = col.findIndex((d) => matches(d, filter));
    if (idx >= 0) {
      applyUpdate(col[idx], update);
      save();
      return { matchedCount: 1, modifiedCount: 1, upsertedId: null };
    }
    if (options.upsert) {
      const doc: Doc = { _id: newId() };
      for (const [k, v] of Object.entries(filter)) {
        if (k.startsWith("$")) continue;
        if (isOperatorObject(v)) continue; // upsert por operador não suportado
        doc[k] = idOf(v);
      }
      applyUpdate(doc, update);
      col.push(doc);
      save();
      return { matchedCount: 0, modifiedCount: 0, upsertedId: doc._id };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedId: null };
  }

  async updateMany(filter: Doc, update: Doc): Promise<{ matchedCount: number; modifiedCount: number }> {
    const col = this.col();
    let count = 0;
    for (const d of col) {
      if (matches(d, filter)) {
        applyUpdate(d, update);
        count += 1;
      }
    }
    if (count) save();
    return { matchedCount: count, modifiedCount: count };
  }

  async deleteOne(filter: Doc): Promise<{ deletedCount: number }> {
    const col = this.col();
    const idx = col.findIndex((d) => matches(d, filter));
    if (idx >= 0) {
      col.splice(idx, 1);
      save();
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter: Doc = {}): Promise<{ deletedCount: number }> {
    const col = this.col();
    const before = col.length;
    for (let i = col.length - 1; i >= 0; i--) {
      if (matches(col[i], filter)) col.splice(i, 1);
    }
    const deletedCount = before - col.length;
    if (deletedCount) save();
    return { deletedCount };
  }

  async createIndex(): Promise<string> {
    return `${this.name}_idx`; // índices são no-op no modo local
  }

  /** Suporta os estágios usados pelo projeto: $match, $group, $sort, $limit. */
  async aggregate(pipeline: Doc[]): Promise<Doc[]> {
    let docs = this.col().map((d) => ({ ...d }));

    for (const stage of pipeline) {
      if (stage.$match) {
        docs = docs.filter((d) => matches(d, stage.$match));
      } else if (stage.$group) {
        const { _id, ...accumulators } = stage.$group;
        const groups = new Map<string, Doc>();
        for (const d of docs) {
          const rawKey = typeof _id === "string" && _id.startsWith("$") ? d[_id.slice(1)] : _id;
          const key = rawKey === null || rawKey === undefined ? "__null__" : String(idOf(rawKey));
          let g = groups.get(key);
          if (!g) {
            g = { _id: rawKey === null ? null : idOf(rawKey) };
            groups.set(key, g);
          }
          for (const [name, acc] of Object.entries(accumulators)) {
            const anyAcc = acc as any;
            if (anyAcc.$sum !== undefined) {
              const val = anyAcc.$sum;
              const amount =
                typeof val === "string" && val.startsWith("$")
                  ? Number(d[val.slice(1)]) || 0
                  : Number(val);
              g[name] = (Number(g[name]) || 0) + amount;
            }
          }
        }
        docs = [...groups.values()];
      } else if (stage.$sort) {
        const keys = Object.entries(stage.$sort);
        docs.sort((a, b) => {
          for (const [k, dir] of keys) {
            const va = a[k];
            const vb = b[k];
            if (va === vb) continue;
            if (va === undefined || va === null) return 1;
            if (vb === undefined || vb === null) return -1;
            return (va > vb ? 1 : -1) * (dir as number);
          }
          return 0;
        });
      } else if (stage.$limit) {
        docs = docs.slice(0, stage.$limit);
      }
    }

    return docs;
  }
}

export class LocalDb {
  collection(name: string): LocalCollection {
    return new LocalCollection(name);
  }

  async command(cmd: Doc = {}): Promise<Doc> {
    if (cmd.ping) return { ok: 1 };
    return { ok: 1 };
  }

  /** Somente para diagnóstico. */
  counts(): Record<string, number> {
    const data = load();
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  }
}

let instance: LocalDb | null = null;

export function getLocalDb(): LocalDb {
  if (!instance) {
    instance = new LocalDb();
    load();
    console.log(`[local-db] modo sem banco: usando ${DATA_FILE}`);
  }
  return instance;
}
