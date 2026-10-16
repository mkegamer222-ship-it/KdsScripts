/**
 * Resolução de Place ID → jogo (API pública da Roblox), com cache.
 * Place ID é o identificador que o site usa no lugar de categorias.
 */

export type RobloxGame = {
  placeId: number;
  universeId: number | null;
  name: string | null;
  creator: string | null;
  thumbnail: string | null;
  playing: number | null;
  visits: number | null;
  updatedAt: string | null;
  resolved: boolean; // conseguiu falar com a API da Roblox?
  error?: string;
};

const memo = new Map<number, { at: number; value: RobloxGame }>();
const TTL = 6 * 60 * 60 * 1000; // 6h

export function isValidPlaceId(value: unknown): boolean {
  const s = String(value ?? "").trim();
  return /^\d{3,20}$/.test(s);
}

async function fetchJson(url: string, revalidate = 21600) {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Place ID → informações do jogo (nome, criador, thumbnail...). */
export async function getGameByPlaceId(
  placeIdInput: number | string,
  opts: { force?: boolean } = {},
): Promise<RobloxGame> {
  const placeId = Number(placeIdInput);
  const base: RobloxGame = {
    placeId,
    universeId: null,
    name: null,
    creator: null,
    thumbnail: null,
    playing: null,
    visits: null,
    updatedAt: null,
    resolved: false,
  };

  if (!Number.isFinite(placeId) || placeId <= 0) {
    return { ...base, error: "Place ID inválido." };
  }

  const cached = memo.get(placeId);
  if (cached && !opts.force && Date.now() - cached.at < TTL) return cached.value;

  try {
    const universe = await fetchJson(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    );
    const universeId = Number(universe?.universeId);
    if (!universeId) throw new Error("place sem universo associado");

    const [detailsRes, thumbRes] = await Promise.allSettled([
      fetchJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
      fetchJson(
        `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
      ),
    ]);

    const details =
      detailsRes.status === "fulfilled" ? detailsRes.value?.data?.[0] ?? null : null;
    const thumb =
      thumbRes.status === "fulfilled"
        ? thumbRes.value?.data?.[0]?.thumbnails?.[0]?.imageUrl ?? null
        : null;

    const value: RobloxGame = {
      placeId,
      universeId,
      name: details?.name ?? null,
      creator: details?.creator?.name ?? null,
      thumbnail: thumb,
      playing: typeof details?.playing === "number" ? details.playing : null,
      visits: typeof details?.visits === "number" ? details.visits : null,
      updatedAt: details?.updated ?? null,
      resolved: Boolean(details?.name),
      error: details?.name ? undefined : "nome do jogo não retornado pela API",
    };

    memo.set(placeId, { at: Date.now(), value });
    return value;
  } catch (err: any) {
    const value: RobloxGame = {
      ...base,
      error: err?.message ? String(err.message).slice(0, 120) : "falha ao consultar a Roblox",
    };
    // cacheia falha por pouco tempo para não martelar a API
    memo.set(placeId, { at: Date.now() - TTL + 60_000, value });
    return value;
  }
}

export function gameUrl(placeId: number) {
  return `https://www.roblox.com/games/${placeId}`;
}
