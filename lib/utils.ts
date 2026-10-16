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

/** Gradientes determinísticos para as capas dos scripts (sem depender de imagens externas) */
const ACCENTS: Record<string, [string, string, string]> = {
  orange: ["#ff6a1a", "#ff9d00", "#2b1206"],
  violet: ["#7c5cff", "#c026d3", "#170b2b"],
  cyan: ["#22d3ee", "#2563eb", "#04222b"],
  lime: ["#a3e635", "#16a34a", "#0d2410"],
  rose: ["#fb7185", "#e11d48", "#2a0713"],
  amber: ["#fbbf24", "#f97316", "#2a1a04"],
  sky: ["#38bdf8", "#6366f1", "#08172e"],
  emerald: ["#34d399", "#0ea5e9", "#04231f"],
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
