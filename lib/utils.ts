export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatNumber(n: number | undefined | null) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(".0", "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(v);
}

export function timeAgo(input: Date | string | undefined) {
  if (!input) return "agora";
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"} atrás`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "ano" : "anos"} atrás`;
}

export function formatDate(input: Date | string | undefined) {
  if (!input) return "-";
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Gradientes determinísticos para as capas dos scripts (verde + preto profundo) */
const ACCENTS: Record<string, [string, string, string]> = {
  emerald: ["#34d399", "#059669", "#03231b"],
  jade: ["#2dd4bf", "#0d9488", "#032726"],
  lime: ["#a3e635", "#4d7c0f", "#12200a"],
  mint: ["#6ee7b7", "#14b8a6", "#032f2a"],
  forest: ["#4ade80", "#166534", "#04231a"],
  neon: ["#bbf7d0", "#22c55e", "#064e3b"],
  teal: ["#5eead4", "#0f766e", "#042f2e"],
  onyx: ["#86efac", "#15803d", "#052e1c"],
};

export const ACCENT_KEYS = Object.keys(ACCENTS);

export function accentOf(seed: string) {
  const key =
    Object.keys(ACCENTS).find((k) => seed?.includes(k)) ??
    ACCENT_KEYS[
      Array.from(seed || "x").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7) %
        ACCENT_KEYS.length
    ];
  return { key, colors: ACCENTS[key] };
}

export function initialsOf(text: string) {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}
