/** Regras de acesso compartilhadas entre servidor e cliente. */
export type Role = "user" | "staff" | "owner";

type Subject = Role | { role?: Role | null } | null | undefined;

function roleOf(subject: Subject): Role | undefined | null {
  if (!subject) return null;
  return typeof subject === "string" ? subject : subject.role;
}

export function isStaff(subject: Subject) {
  const role = roleOf(subject);
  return role === "staff" || role === "owner";
}

export function isOwner(subject: Subject) {
  return roleOf(subject) === "owner";
}

export function roleLabel(subject: Subject) {
  const role = roleOf(subject);
  if (role === "owner") return "Dono";
  if (role === "staff") return "Staff";
  return "Membro";
}
