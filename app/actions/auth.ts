"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  changePassword,
  destroySession,
  getCurrentUser,
  loginUser,
  registerUser,
} from "@/lib/auth";

export type FormState = { error?: string; ok?: boolean } | undefined;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = str(formData.get("username"));
  const displayName = str(formData.get("displayName"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "As senhas não são iguais." };

  const result = await registerUser(username, password, displayName);
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  redirect("/conta");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = str(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const next = str(formData.get("next")) || "/conta";

  const result = await loginUser(username, password);
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/conta");
}

/** Usada pelo menu do cabeçalho (form action). */
export async function destroySessionAndRedirect() {
  await destroySession();
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para continuar." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next !== confirm) return { error: "A confirmação não confere." };

  const result = await changePassword(user.id, current, next);
  if (!result.ok) return { error: result.error };

  return { ok: true };
}
