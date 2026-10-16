import { getDb } from "./mongodb";
import { hashPassword, normalizeUsername, type UserDoc } from "./auth";

/**
 * Preparação do banco: índices + conta de staff inicial.
 * Roda uma vez por processo, de forma idempotente.
 *
 * A conta de dono é criada a partir de STAFF_USERNAME / STAFF_PASSWORD.
 * Recomendado: trocar a senha pelo painel depois do primeiro acesso.
 */

let ready: Promise<void> | null = null;

async function ensureIndexes() {
  const db = await getDb();

  await Promise.all([
    db.collection("users").createIndex({ username: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db
      .collection("sessions")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch(() => {}),
    db.collection("games").createIndex({ placeId: 1 }, { unique: true }),
    db.collection("games").createIndex({ status: 1, createdAt: -1 }),
    db.collection("scripts").createIndex({ slug: 1 }, { unique: true }),
    db.collection("scripts").createIndex({ status: 1, createdAt: -1 }),
    db.collection("scripts").createIndex({ placeId: 1, status: 1 }),
    db.collection("scripts").createIndex({ views: -1 }),
    db.collection("scripts").createIndex({ authorId: 1 }),
  ]);
}

async function ensureOwnerAccount() {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");

  const owner = await users.findOne({ role: "owner" });
  if (owner) return;

  const rawUsername = process.env.STAFF_USERNAME || "kdss";
  const username = normalizeUsername(rawUsername);
  const password = process.env.STAFF_PASSWORD || "";

  if (!password) {
    console.warn(
      "[bootstrap] STAFF_PASSWORD não definida: a conta de staff não foi criada. " +
        "Defina STAFF_USERNAME e STAFF_PASSWORD para criar o acesso de staff.",
    );
    return;
  }

  const existing = await users.findOne({ username });
  const { hash, salt } = hashPassword(password);

  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      { $set: { role: "owner", passwordHash: hash, salt, banned: false } },
    );
    console.log(`[bootstrap] conta ${username} promovida a owner.`);
  } else {
    await users.insertOne({
      username,
      displayName: rawUsername,
      passwordHash: hash,
      salt,
      role: "owner",
      banned: false,
      createdAt: new Date(),
    });
    console.log(`[bootstrap] conta de owner "${username}" criada.`);
  }
}

/** Garante índices e conta de staff. Falhas não derrubam a aplicação. */
export function ensureBootstrap() {
  if (!ready) {
    ready = (async () => {
      await ensureIndexes();
      await ensureOwnerAccount();
    })().catch((err) => {
      console.error("[bootstrap] falhou:", err?.message || err);
      ready = null; // tenta novamente no próximo request
    });
  }
  return ready;
}

export async function ensureIndexesOnly() {
  await ensureIndexes().catch(() => {});
}
