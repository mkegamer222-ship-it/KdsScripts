import type { GameStatus, ScriptStatus } from "./config";
import type { Role } from "./permissions";

export type ScriptDoc = {
  _id?: any;
  slug: string;
  title: string;
  description: string;
  code: string;

  placeId: number;
  gameName: string;
  gameThumbnail?: string | null;

  tags: string[];
  features: string[];
  version: string;
  keySystem: boolean;
  status: ScriptStatus;

  authorId?: string;
  authorName: string;

  views: number;
  likes: number;
  copies: number;

  reviewedBy?: string;
  reviewedAt?: Date | string;
  reviewNote?: string;

  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ScriptListItem = Omit<ScriptDoc, "code"> & { codeLength?: number };

export type GameDoc = {
  _id?: any;
  placeId: number;
  name: string;
  universeId?: number | null;
  creator?: string | null;
  thumbnail?: string | null;
  status: GameStatus;

  submittedBy?: string;
  reviewedBy?: string;
  reviewedAt?: Date | string;
  reviewNote?: string;

  createdAt: Date | string;
  updatedAt: Date | string;
};

export type GameListItem = GameDoc & { scriptCount?: number };

export type ListResult<T = ScriptListItem> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

/** Usuário da sessão (seguro para o cliente — sem nada sensível). */
export type SessionUser = {
  id: string;
  username: string;
  role: Role;
  createdAt?: string;
};

export type PublicUser = {
  id: string;
  username: string;
  role: Role;
  banned?: boolean;
  createdAt?: string;
  scripts?: number;
};
