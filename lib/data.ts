import { getDb } from "./mysql";
import { ensureBootstrap } from "./bootstrap";
import type { GameDoc, GameListItem, ListResult, PublicUser, ScriptDoc, ScriptListItem } from "./types";
import type { ScriptStatus } from "./config";

/**
 * Acesso a dados (scripts e jogos).
 * - cache em memória com TTL curto + stale-while-revalidate
 * - deduplicação de consultas simultâneas
 * - se o banco estiver fora, as funções devolvem vazio (o site não quebra nem trava)
 */

const TTL_LIST = 20_000;
const TTL_ONE = 20_000;
const TTL_STATS = 60_000;

type Entry = { at: number; value: unknown };
const memo = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function refresh<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn().then(
    (value) => {
      memo.set(key, { at: Date.now(), value });
      inflight.delete(key);
      return value;
    },
    (err) => {
      inflight.delete(key);
      throw err;
    },
  );
  inflight.set(key, p);
  return p;
}

async function withCache<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit) {
    if (Date.now() - hit.at < ttl) return hit.value as T;
    void refresh(key, fn).catch(() => {});
    return hit.value as T;
  }
  return refresh(key, fn);
}

export function bustDataCache() {
  memo.clear();
}

export function cacheInfo() {
  return { entradas: memo.size };
}

/* ------------------------------------------------------------------ */

const EMPTY_PAGE = (page = 1, limit = 12): ListResult => ({
  items: [],
  total: 0,
  page,
  pages: 1,
  limit,
});

const SCRIPT_PROJECTION = {
  _id: 0,
  slug: 1, title: 1, description: 1, placeId: 1, gameName: 1, gameThumbnail: 1,
  tags: 1, features: 1, version: 1, keySystem: 1, status: 1, authorId: 1, authorName: 1,
  views: 1, likes: 1, copies: 1, createdAt: 1, updatedAt: 1,
} as const;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortStage(sort?: string) {
  switch (sort) {
    case "views":
      return { views: -1 } as Record<string, 1 | -1>;
    case "likes":
      return { likes: -1 } as Record<string, 1 | -1>;
    case "az":
      return { title: 1 } as Record<string, 1 | -1>;
    default:
      return { createdAt: -1 } as Record<string, 1 | -1>;
  }
}

function asIso(value: any) {
  return value instanceof Date ? value.toISOString() : value;
}

export type ListParams = {
  q?: string;
  placeId?: number | string;
  game?: string;
  tag?: string;
  sort?: string;
  page?: number;
  limit?: number;
  status?: ScriptStatus | "all";
  authorId?: string;
};

/** Lista scripts publicados (ou filtros internos, quando `status` é informado). */
export async function listScripts(params: ListParams = {}): Promise<ListResult> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(params.limit) || 12));
  const status = params.status ?? "approved";
  const key = `list:${JSON.stringify({ ...params, page, limit, status })}`;

  return withCache(key, TTL_LIST, async () => {
    try {
      await ensureBootstrap();
      const db = await getDb();
      const filter: Record<string, any> = {};
      if (status !== "all") filter.status = status;

      if (params.placeId && Number(params.placeId)) filter.placeId = Number(params.placeId);
      if (params.game) filter.gameName = { $regex: `^${escapeRegex(params.game)}$`, $options: "i" };
      if (params.tag) filter.tags = params.tag;
      if (params.authorId) filter.authorId = params.authorId;
      if (params.q) {
        const rx = new RegExp(escapeRegex(params.q), "i");
        filter.$or = [
          { title: rx },
          { gameName: rx },
          { description: rx },
          { tags: rx },
          { authorName: rx },
        ];
      }

      const col = db.collection("scripts");
      const [docs, total] = await Promise.all([
        col
          .find(filter, { projection: SCRIPT_PROJECTION })
          .sort(sortStage(params.sort))
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        col.countDocuments(filter),
      ]);

      return {
        items: (docs as any[]).map((d) => ({
          ...d,
          createdAt: asIso(d.createdAt),
          updatedAt: asIso(d.updatedAt),
        })),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        limit,
      };
    } catch {
      return EMPTY_PAGE(page, limit);
    }
  });
}

/** Lista scripts incluindo o código (usado pelo painel da staff). */
export async function listScriptsWithCode(params: {
  status?: ScriptStatus | "all";
  limit?: number;
} = {}): Promise<ScriptDoc[]> {
  try {
    await ensureBootstrap();
    const db = await getDb();
    const filter: Record<string, any> = {};
    if (params.status && params.status !== "all") filter.status = params.status;

    const docs = await db
      .collection("scripts")
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(Math.min(100, params.limit ?? 50))
      .toArray();

    return docs.map((d: any) => ({
      ...d,
      createdAt: asIso(d.createdAt),
      updatedAt: asIso(d.updatedAt),
    })) as ScriptDoc[];
  } catch {
    return [];
  }
}

export async function getScript(slug: string, status?: ScriptStatus): Promise<ScriptDoc | null> {
  return withCache(`script:${slug}:${status ?? "approved"}`, TTL_ONE, async () => {
    try {
      await ensureBootstrap();
      const db = await getDb();
      const filter: Record<string, any> = { slug };
      if (status) filter.status = status;
      const doc = await db.collection("scripts").findOne(filter, { projection: { _id: 0 } });
      if (!doc) return null;
      const d: any = doc;
      d.createdAt = asIso(d.createdAt);
      d.updatedAt = asIso(d.updatedAt);
      return d as ScriptDoc;
    } catch {
      return null;
    }
  });
}

export async function relatedScripts(doc: ScriptDoc, limit = 6): Promise<ScriptListItem[]> {
  const key = `related:${doc.slug}:${limit}`;
  return withCache(key, TTL_LIST, async () => {
    const [byGame, byAuthor] = await Promise.all([
      listScripts({ placeId: doc.placeId, limit: limit + 1 }),
      doc.authorId ? listScripts({ authorId: doc.authorId, limit: limit * 2 }) : Promise.resolve(EMPTY_PAGE()),
    ]);

    const merged = byGame.items.filter((s) => s.slug !== doc.slug);
    for (const s of byAuthor.items) {
      if (s.slug !== doc.slug && !merged.some((m) => m.slug === s.slug)) merged.push(s);
      if (merged.length >= limit) break;
    }
    return merged.slice(0, limit);
  });
}

/* ------------------------------------------------------------------ */
/* Jogos (Place ID)                                                    */
/* ------------------------------------------------------------------ */

export async function listGames(params: {
  status?: GameDoc["status"] | "all";
  q?: string;
  limit?: number;
  page?: number;
} = {}): Promise<ListResult<GameListItem>> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(params.limit) || 24));
  const status = params.status ?? "approved";
  const key = `games:${JSON.stringify({ ...params, page, limit, status })}`;

  return withCache(key, TTL_LIST, async () => {
    try {
      await ensureBootstrap();
      const db = await getDb();

      const filter: Record<string, any> = {};
      if (status !== "all") filter.status = status;
      if (params.q) {
        const rx = new RegExp(escapeRegex(params.q), "i");
        filter.$or = [{ name: rx }, { creator: rx }];
      }

      const col = db.collection("games");
      const [docs, total] = await Promise.all([
        col
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        col.countDocuments(filter),
      ]);

      const ids = docs.map((d: any) => d.placeId);
      const counts = ids.length
        ? await db
            .collection("scripts")
            .aggregate([
              { $match: { placeId: { $in: ids }, status: "approved" } },
              { $group: { _id: "$placeId", count: { $sum: 1 } } },
            ])
            .toArray()
        : [];
      const countMap = new Map(counts.map((c: any) => [c._id, c.count as number]));

      return {
        items: docs.map((d: any) => ({
          ...d,
          _id: undefined,
          createdAt: asIso(d.createdAt),
          updatedAt: asIso(d.updatedAt),
          scriptCount: countMap.get(d.placeId) ?? 0,
        })) as GameListItem[],
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        limit,
      };
    } catch {
      return { items: [], total: 0, page, pages: 1, limit } as ListResult<GameListItem>;
    }
  });
}

export async function getGame(placeId: number | string, status?: GameDoc["status"]) {
  const id = Number(placeId);
  if (!Number.isFinite(id)) return null;
  return withCache(`game:${id}:${status ?? "approved"}`, TTL_ONE, async () => {
    try {
      await ensureBootstrap();
      const db = await getDb();
      const filter: Record<string, any> = { placeId: id };
      if (status) filter.status = status;
      const doc = await db.collection("games").findOne(filter, { projection: { _id: 0 } });
      if (!doc) return null;
      return { ...(doc as any), createdAt: asIso((doc as any).createdAt), updatedAt: asIso((doc as any).updatedAt) } as GameDoc;
    } catch {
      return null;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Contadores e estatísticas                                           */
/* ------------------------------------------------------------------ */

export async function increment(slug: string, field: "views" | "likes" | "copies") {
  try {
    const db = await getDb();
    const res = await db
      .collection("scripts")
      .updateOne({ slug, status: "approved" }, { $inc: { [field]: 1 } });
    memo.delete(`script:${slug}:approved`);
    return res.modifiedCount > 0;
  } catch {
    return false;
  }
}

export type Stats = {
  scripts: number;
  games: number;
  users: number;
  views: number;
  pendingScripts: number;
  pendingGames: number;
};

const EMPTY_STATS: Stats = {
  scripts: 0, games: 0, users: 0, views: 0, pendingScripts: 0, pendingGames: 0,
};

export async function getStats(): Promise<Stats> {
  return withCache("stats", TTL_STATS, async () => {
    try {
      await ensureBootstrap();
      const db = await getDb();
      const [scripts, games, users, viewsAgg, pendingScripts, pendingGames] = await Promise.all([
        db.collection("scripts").countDocuments({ status: "approved" }),
        db.collection("games").countDocuments({ status: "approved" }),
        db.collection("users").countDocuments({}),
        db
          .collection("scripts")
          .aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, v: { $sum: "$views" } } }])
          .toArray(),
        db.collection("scripts").countDocuments({ status: "pending" }),
        db.collection("games").countDocuments({ status: "pending" }),
      ]);
      return {
        scripts,
        games,
        users,
        views: viewsAgg[0]?.v || 0,
        pendingScripts,
        pendingGames,
      };
    } catch {
      return EMPTY_STATS;
    }
  });
}

export async function listUsers(limit = 100): Promise<PublicUser[]> {
  return withCache(`users:${limit}`, TTL_STATS, async () => {
    try {
      await ensureBootstrap();
      const db = await getDb();
      const docs = await db
        .collection("users")
        .find({}, { projection: { username: 1, displayName: 1, role: 1, banned: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return docs.map((u: any) => ({
        id: String(u._id),
        username: u.displayName || u.username,
        role: u.role,
        banned: !!u.banned,
        createdAt: asIso(u.createdAt),
      }));
    } catch {
      return [];
    }
  });
}
