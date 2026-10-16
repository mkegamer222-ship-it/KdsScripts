export const SITE = {
  name: "KDS Scripts",
  short: "KDS",
  tagline: "Scripts publicados pela comunidade",
  description:
    "Biblioteca de scripts para jogos do Roblox publicada pela comunidade. Cada script informa o jogo (pelo Place ID) e o autor.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  footerNote:
    "KDS Scripts não é afiliado à Roblox Corporation. Use os scripts por sua conta e risco.",
};

export const SORTS = [
  { value: "newest", label: "Mais recentes" },
  { value: "views", label: "Mais vistos" },
  { value: "likes", label: "Mais curtidos" },
  { value: "az", label: "A - Z" },
] as const;

export const SCRIPT_STATUS = {
  pending: "Pendente",
  approved: "Publicado",
  rejected: "Recusado",
} as const;

export const GAME_STATUS = {
  pending: "Pendente",
  approved: "Validado",
  rejected: "Recusado",
} as const;

export type ScriptStatus = keyof typeof SCRIPT_STATUS;
export type GameStatus = keyof typeof GAME_STATUS;
