"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SORTS } from "@/lib/config";
import type { GameListItem } from "@/lib/types";

export default function FilterBar({ total = 0 }: { total?: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [games, setGames] = useState<GameListItem[]>([]);

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  useEffect(() => {
    fetch("/api/games?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGames(d.items ?? []))
      .catch(() => setGames([]));
  }, []);

  const current = {
    q: params.get("q") ?? "",
    sort: params.get("sort") ?? "newest",
    placeId: params.get("placeId") ?? "",
  };

  function push(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    router.push(`/scripts?${sp.toString()}`);
  }

  return (
    <div className="card p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() || undefined });
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, jogo, tag ou autor"
          className="input"
        />
        <select
          value={current.placeId}
          onChange={(e) => push({ placeId: e.target.value })}
          className="input sm:w-[220px]"
        >
          <option value="" style={{ background: "#0a110c" }}>
            Todos os jogos
          </option>
          {games.map((g) => (
            <option key={g.placeId} value={g.placeId} style={{ background: "#0a110c" }}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={current.sort}
          onChange={(e) => push({ sort: e.target.value })}
          className="input sm:w-[170px]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value} style={{ background: "#0a110c" }}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary sm:w-[120px]">
          Filtrar
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <span>
          {total} {total === 1 ? "script" : "scripts"}
        </span>
        {(current.q || current.placeId || current.sort !== "newest") && (
          <button onClick={() => push({ q: undefined, placeId: undefined, sort: undefined })} className="chip chip-blue">
            ✕ Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
