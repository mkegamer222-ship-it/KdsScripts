"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { getCurrentUser, isOwner, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { bustDataCache } from "@/lib/data";
import { upsertGameFromPlaceId } from "@/lib/actions-helpers";
import { isValidPlaceId } from "@/lib/roblox";
import type { ScriptDoc } from "@/lib/types";
import type { Role } from "@/lib/auth";

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function requireStaff() {
  const user = await getCurrentUser();
  if (!isStaff(user)) return null;
  return user!;
}

function refreshAll() {
  bustDataCache();
  revalidatePath("/");
  revalidatePath("/scripts");
  revalidatePath("/jogos");
  revalidatePath("/staff");
}

/* --------------------------- Scripts --------------------------- */

export async function reviewScriptAction(formData: FormData) {
  const staff = await requireStaff();
  if (!staff) return;

  const slug = str(formData.get("slug"));
  const decision = str(formData.get("decision")); // approve | reject
  const note = str(formData.get("note")).slice(0, 300);

  if (!slug || !["approve", "reject"].includes(decision)) return;

  try {
    const db = await getDb();
    const script = await db.collection<ScriptDoc>("scripts").findOne({ slug });
    if (!script) return;

    await db.collection("scripts").updateOne(
      { slug },
      {
        $set: {
          status: decision === "approve" ? "approved" : "rejected",
          reviewedBy: staff.username,
          reviewedAt: new Date(),
          reviewNote: note || undefined,
          updatedAt: new Date(),
        },
      },
    );

    // jogo continua pendente até ser validado individualmente
    refreshAll();
    revalidatePath("/conta");
  } catch {
    /* silencioso */
  }
  revalidatePath("/staff");
}

export async function deleteScriptAsStaffAction(formData: FormData) {
  const staff = await requireStaff();
  if (!staff) return;
  const slug = str(formData.get("slug"));
  if (!slug) return;

  try {
    const db = await getDb();
    await db.collection("scripts").deleteOne({ slug });
    refreshAll();
  } catch {
    /* silencioso */
  }
  revalidatePath("/staff");
}

/* ---------------------------- Jogos ---------------------------- */

export async function reviewGameAction(formData: FormData) {
  const staff = await requireStaff();
  if (!staff) return;

  const placeId = Number(str(formData.get("placeId")));
  const decision = str(formData.get("decision")); // approve | reject
  const note = str(formData.get("note")).slice(0, 300);

  if (!Number.isFinite(placeId) || !["approve", "reject"].includes(decision)) return;

  try {
    const db = await getDb();
    await db.collection("games").updateOne(
      { placeId },
      {
        $set: {
          status: decision === "approve" ? "approved" : "rejected",
          reviewedBy: staff.username,
          reviewedAt: new Date(),
          reviewNote: note || undefined,
          updatedAt: new Date(),
        },
      },
    );
    refreshAll();
  } catch {
    /* silencioso */
  }
  revalidatePath("/staff");
}

/** Staff cadastra/valida um jogo diretamente pelo Place ID. */
export async function addGameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff) return { error: "Acesso restrito." };

  const placeId = str(formData.get("placeId"));
  if (!isValidPlaceId(placeId)) return { error: "Place ID inválido (só números)." };

  try {
    const { game, created, error } = await upsertGameFromPlaceId(placeId, staff.username, true);
    if (!game) return { error: error || "Não foi possível cadastrar." };

    const db = await getDb();
    await db
      .collection("games")
      .updateOne({ placeId: game.placeId }, { $set: { status: "approved", updatedAt: new Date() } });

    refreshAll();
    return { ok: true, message: created ? `Jogo "${game.name}" cadastrado.` : `Jogo "${game.name}" atualizado.` };
  } catch {
    return { error: "Falha ao cadastrar o jogo." };
  }
}

export async function updateGameNameAction(formData: FormData) {
  const staff = await requireStaff();
  if (!staff) return;

  const placeId = Number(str(formData.get("placeId")));
  const name = str(formData.get("name")).slice(0, 120);
  if (!Number.isFinite(placeId) || name.length < 2) return;

  try {
    const db = await getDb();
    await db
      .collection("games")
      .updateOne({ placeId }, { $set: { name, updatedAt: new Date() } });
    await db
      .collection("scripts")
      .updateMany({ placeId }, { $set: { gameName: name } });
    refreshAll();
  } catch {
    /* silencioso */
  }
  revalidatePath("/staff");
}

/* --------------------------- Usuários -------------------------- */

export async function setUserRoleAction(formData: FormData) {
  const staff = await requireStaff();
  if (!isOwner(staff)) return;

  const userId = str(formData.get("userId"));
  const role = str(formData.get("role")) as Role;
  if (!userId || !["user", "staff", "owner"].includes(role)) return;

  try {
    const db = await getDb();
    const target = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (!target) return;
    // não rebaixa o último owner
    if (target.role === "owner" && role !== "owner") {
      const owners = await db.collection("users").countDocuments({ role: "owner" });
      if (owners <= 1) return;
    }

    await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { role } });
    bustDataCache();
  } catch {
    /* silencioso */
  }
  revalidatePath("/staff");
}

export async function toggleUserBanAction(formData: FormData) {
  const staff = await requireStaff();
  if (!isOwner(staff)) return;

  const userId = str(formData.get("userId"));
  if (!userId) return;

  try {
    const db = await getDb();
    const target = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (!target || target.role === "owner") return;

    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(userId) }, { $set: { banned: !target.banned } });
    bustDataCache();
  } catch {
    /* silencioso */
  }
  revalidatePath("/staff");
}
