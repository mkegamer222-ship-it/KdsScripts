import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./mysql";
import type { Role } from "./permissions";
import type { SessionUser } from "./types";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type { Role, SessionUser };

export type UserDoc = {
  _id?: string;
  username: string; // sempre minúsculo
  displayName: string;
  passwordHash: string;
  salt: string;
  role: Role;
  banned: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
};

export const COOKIE_NAME = "kds_session";
const SESSION_DAYS = 30;

export { isStaff, isOwner } from "./permissions";

/* ------------------------------------------------------------------ */
/* Senhas (scrypt, sem dependência externa)                            */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  try {
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Validações                                                          */
/* ------------------------------------------------------------------ */

export function normalizeUsername(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < 3) return "O usuário precisa ter pelo menos 3 caracteres.";
  if (u.length > 24) return "O usuário pode ter no máximo 24 caracteres.";
  if (!/^[a-z0-9_.]+$/.test(u)) return "Use apenas letras, números, ponto e underline.";
  return null;
}

export function validatePassword(raw: string): string | null {
  const p = String(raw || "");
  if (p.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  if (p.length > 200) return "Senha muito longa.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Sessões (persistidas no banco, revogáveis)                          */
/* ------------------------------------------------------------------ */

const users = async () => (await getDb()).collection<UserDoc>("users");
const sessions = async () => (await getDb()).collection("sessions");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const sessionCollection = await sessions();
  // O MySQL não tem TTL automático como o índice anterior do MongoDB.
  await sessionCollection.deleteMany({ expiresAt: { $lte: new Date() } }).catch(() => {});
  await sessionCollection.insertOne({ token, userId, createdAt: new Date(), expiresAt });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await (await sessions()).deleteOne({ token }).catch(() => {});
  }
  jar.delete(COOKIE_NAME);
}

/** Usuário da sessão atual (ou null). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await (await sessions()).findOne({ token });
    if (!session || new Date(session.expiresAt) < new Date()) return null;

    const user = await (await users()).findOne({ _id: session.userId });
    if (!user || user.banned) return null;

    return {
      id: String(user._id),
      username: user.displayName || user.username,
      role: user.role,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Operações de conta                                                  */
/* ------------------------------------------------------------------ */

export type AuthResult = { ok: true; user: SessionUser } | { ok: false; error: string };

export async function registerUser(
  usernameRaw: string,
  password: string,
  displayNameRaw?: string,
): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, error: usernameError };

  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    const col = await users();
    const existing = await col.findOne({ username });
    if (existing) return { ok: false, error: "Esse usuário já está em uso." };

    const { hash, salt } = hashPassword(password);
    const doc: UserDoc = {
      username,
      displayName: (displayNameRaw || usernameRaw).trim().slice(0, 40) || username,
      passwordHash: hash,
      salt,
      role: "user",
      banned: false,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    const res = await col.insertOne(doc);
    await createSession(res.insertedId);

    return {
      ok: true,
      user: { id: String(res.insertedId), username: doc.displayName, role: "user" },
    };
  } catch (err: any) {
    // Nunca engolir o erro em silêncio: era por isso que só aparecia a
    // mensagem genérica e ninguém sabia que o banco estava fora/errado.
    console.error("[auth] registerUser falhou:", err?.code || err?.name || "erro desconhecido");
    if (err?.code === 11000 || err?.code === "ER_DUP_ENTRY") return { ok: false, error: "Esse usuário já está em uso." };
    if (err?.name === "DbUnavailableError" || err?.code === "DB_UNAVAILABLE") {
      return {
        ok: false,
        error: "Banco de dados indisponível no momento. Tente de novo em alguns segundos.",
      };
    }
    return { ok: false, error: "Não foi possível criar a conta agora. Tente de novo em alguns segundos." };
  }
}

export async function loginUser(usernameRaw: string, password: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  if (!username || !password) return { ok: false, error: "Informe usuário e senha." };

  try {
    const col = await users();
    const user = await col.findOne({ username });
    // mensagem genérica de propósito (não revela se o usuário existe)
    const invalid = { ok: false as const, error: "Usuário ou senha incorretos." };
    if (!user) return invalid;
    if (user.banned) return { ok: false, error: "Esta conta está suspensa." };
    if (!verifyPassword(password, user.salt, user.passwordHash)) return invalid;

    await col.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    await createSession(user._id!);

    return {
      ok: true,
      user: {
        id: String(user._id),
        username: user.displayName || user.username,
        role: user.role,
      },
    };
  } catch (err: any) {
    console.error("[auth] loginUser falhou:", err?.code || err?.name || "erro desconhecido");
    if (err?.name === "DbUnavailableError" || err?.code === "DB_UNAVAILABLE") {
      return {
        ok: false,
        error: "Banco de dados indisponível no momento. Tente de novo em alguns segundos.",
      };
    }
    return { ok: false, error: "Não foi possível entrar agora. Tente de novo em alguns segundos." };
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const passwordError = validatePassword(newPassword);
  if (passwordError) return { ok: false as const, error: passwordError };

  try {
    const col = await users();
    const user = await col.findOne({ _id: userId });
    if (!user) return { ok: false as const, error: "Conta não encontrada." };
    if (!verifyPassword(currentPassword, user.salt, user.passwordHash)) {
      return { ok: false as const, error: "Senha atual incorreta." };
    }

    const { hash, salt } = hashPassword(newPassword);
    await col.updateOne({ _id: user._id }, { $set: { passwordHash: hash, salt } });
    // encerra as outras sessões por segurança
    await (await sessions()).deleteMany({ userId: user._id }).catch(() => {});
    await createSession(user._id!);

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Não foi possível alterar a senha." };
  }
}
