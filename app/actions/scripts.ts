"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/mysql";
import { bustDataCache } from "@/lib/data";
import { isValidPlaceId } from "@/lib/roblox";
import { parseList, uniqueSlug, upsertGameFromPlaceId } from "@/lib/actions-helpers";
import type { ScriptDoc } from "@/lib/types";

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Envio de script pela comunidade. Fica pendente até um staff aprovar
 *  (envios de staff entram publicados). */
export async function submitScriptAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta para publicar um script." };

  const title = str(formData.get("title")).slice(0, 160);
  const description = str(formData.get("description")).slice(0, 1500);
  const code = String(formData.get("code") ?? "");
  const placeIdRaw = str(formData.get("placeId"));
  const version = str(formData.get("version")).slice(0, 24) || "1.0.0";
  const keySystem = formData.get("keySystem") === "on";
  const tags = parseList(formData.get("tags"), 10);
  const features = parseList(formData.get("features"), 12);

  if (title.length < 3) return { error: "Informe um título com pelo menos 3 caracteres." };
  if (!isValidPlaceId(placeIdRaw)) return { error: "Informe um Place ID válido (só números)." };
  if (code.trim().length < 10) return { error: "Cole o código do script." };
  if (code.length > 200_000) return { error: "Código muito grande (limite de 200 mil caracteres)." };

  const staff = isStaff(user);

  try {
    const { game, error } = await upsertGameFromPlaceId(placeIdRaw, user.username, staff);
    if (!game) return { error: error || "Place ID inválido." };

    const db = await getDb();
    const slug = await uniqueSlug(`${title}`);

    const doc: ScriptDoc = {
      slug,
      title,
      description,
      code,
      placeId: game.placeId,
      gameName: game.name,
      gameThumbnail: game.thumbnail ?? null,
      tags,
      features,
      version,
      keySystem,
      status: staff ? "approved" : "pending",
      authorId: user.id,
      authorName: user.username,
      views: 0,
      likes: 0,
      copies: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("scripts").updateOne({ slug }, { $set: doc }, { upsert: true });
    bustDataCache();
    revalidatePath("/scripts");
    revalidatePath("/jogos");
  } catch {
    return { error: "Não foi possível salvar agora. Tente novamente." };
  }

  redirect(staff ? "/scripts" : "/conta?enviado=1");
}

/** Edição pelo autor (ou por staff). Volta para revisão do staff. */
export async function updateOwnScriptAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para continuar." };

  const slug = str(formData.get("slug"));
  if (!slug) return { error: "Script não informado." };

  const title = str(formData.get("title")).slice(0, 160);
  const description = str(formData.get("description")).slice(0, 1500);
  const code = String(formData.get("code") ?? "");
  const version = str(formData.get("version")).slice(0, 24) || "1.0.0";
  const keySystem = formData.get("keySystem") === "on";
  const tags = parseList(formData.get("tags"), 10);
  const features = parseList(formData.get("features"), 12);

  if (title.length < 3) return { error: "Título muito curto." };
  if (code.trim().length < 10) return { error: "Cole o código do script." };

  try {
    const db = await getDb();
    const existing = await db.collection<ScriptDoc>("scripts").findOne({ slug });
    if (!existing) return { error: "Script não encontrado." };

    const isOwnerOfScript = existing.authorId === user.id;
    if (!isOwnerOfScript && !isStaff(user)) return { error: "Você não pode editar este script." };

    const staff = isStaff(user);
    await db.collection("scripts").updateOne(
      { slug },
      {
        $set: {
          title,
          description,
          code,
          version,
          keySystem,
          tags,
          features,
          // edição de usuário volta para a fila de revisão
          status: staff ? "approved" : "pending",
          updatedAt: new Date(),
        },
      },
    );

    bustDataCache();
    revalidatePath("/conta");
    revalidatePath(`/scripts/${slug}`);
    revalidatePath("/staff");
  } catch {
    return { error: "Não foi possível salvar agora." };
  }

  redirect("/conta?saved=1");
}

/** Remove um script (autor ou staff). */
export async function deleteOwnScriptAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const slug = str(formData.get("slug"));
  if (!slug) return;

  try {
    const db = await getDb();
    const existing = await db.collection<ScriptDoc>("scripts").findOne({ slug });
    if (!existing) return;
    if (existing.authorId !== user.id && !isStaff(user)) return;

    await db.collection("scripts").deleteOne({ slug });
    bustDataCache();
    revalidatePath("/conta");
    revalidatePath("/scripts");
  } catch {
    /* silencioso */
  }
  redirect("/conta?removido=1");
}
