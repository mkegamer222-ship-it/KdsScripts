import { getGameByPlaceId, isValidPlaceId } from "./roblox";
import { getDb } from "./mysql";
import { bustDataCache } from "./data";
import { slugify } from "./utils";
import type { GameDoc } from "./types";

/**
 * Cria (ou encontra) o jogo a partir do Place ID.
 * Jogos enviados pela comunidade entram como "pending" e só aparecem no site
 * depois que um staff valida — exceto quando quem envia é do staff.
 */
export async function upsertGameFromPlaceId(
  placeIdInput: number | string,
  submittedBy?: string,
  autoApprove = false,
): Promise<{ game: GameDoc | null; created: boolean; error?: string }> {
  if (!isValidPlaceId(placeIdInput)) {
    return { game: null, created: false, error: "Informe um Place ID válido (só números)." };
  }

  const placeId = Number(placeIdInput);
  const db = await getDb();
  const games = db.collection<GameDoc>("games");

  const existing = await games.findOne({ placeId });
  const info = await getGameByPlaceId(placeId);

  const name = info.name || (existing?.name ?? `Place ${placeId}`);

  if (existing) {
    // atualiza metadados quando a API respondeu
    if (info.resolved) {
      await games.updateOne(
        { placeId },
        {
          $set: {
            name: info.name || existing.name,
            universeId: info.universeId,
            creator: info.creator,
            thumbnail: info.thumbnail,
            updatedAt: new Date(),
          },
        },
      );
    }
    return { game: { ...existing, name }, created: false };
  }

  const doc: GameDoc = {
    placeId,
    name,
    universeId: info.universeId,
    creator: info.creator,
    thumbnail: info.thumbnail,
    status: autoApprove ? "approved" : "pending",
    submittedBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await games.insertOne(doc as any);
  } catch {
    // corrida: outro request criou o mesmo placeId
  }

  bustDataCache();
  return { game: doc, created: true };
}

/** Gera um slug único para o script. */
export async function uniqueSlug(base: string, ignoreSlug?: string) {
  const db = await getDb();
  const col = db.collection("scripts");
  let slug = slugify(base).slice(0, 72) || `script-${Date.now()}`;

  for (let i = 0; i < 6; i++) {
    const found = await col.findOne({ slug }, { projection: { slug: 1 } });
    if (!found || found.slug === ignoreSlug) return slug;
    slug = `${slugify(base).slice(0, 66)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slugify(base).slice(0, 60)}-${Date.now().toString(36)}`;
}

export function parseList(raw: FormDataEntryValue | null | undefined, max = 12) {
  return String(raw ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}
