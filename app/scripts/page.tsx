import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import ScriptCard from "@/components/ScriptCard";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import { EmptyState } from "@/components/Section";
import { getGame, listScripts } from "@/lib/data";

export const revalidate = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const q = one(sp.q);
  return {
    title: q ? `Busca: ${q}` : "Scripts",
    description: "Scripts publicados pela comunidade, com o jogo identificado pelo Place ID.",
  };
}

export default async function ScriptsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const placeId = one(sp.placeId);
  const sort = one(sp.sort) || "newest";
  const page = Number(one(sp.page) || 1);

  const [result, game] = await Promise.all([
    listScripts({ q, placeId, sort, page, limit: 12 }),
    placeId ? getGame(placeId, "approved") : Promise.resolve(null),
  ]);

  const heading = q ? `Resultados para “${q}”` : game ? game.name : "Todos os scripts";

  return (
    <div className="space-y-6 pt-4">
      <header>
        <nav className="flex items-center gap-2 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-brand-400">
            Início
          </Link>
          <span>/</span>
          <span className="text-slate-300">Scripts</span>
        </nav>
        <h1 className="mt-2 text-[28px] font-black tracking-tight text-white sm:text-[34px]">
          {heading}
        </h1>
        {game && (
          <p className="mt-1.5 font-mono text-[12.5px] text-slate-500">
            Place ID {game.placeId}
            {game.creator ? ` · por ${game.creator}` : ""}
          </p>
        )}
      </header>

      <Suspense fallback={<div className="skeleton h-28 w-full rounded-2xl" />}>
        <FilterBar total={result.total} />
      </Suspense>

      {result.items.length === 0 ? (
        <EmptyState
          title="Nenhum script encontrado"
          hint="A lista pode estar vazia ou os filtros não retornaram resultados. Você pode publicar um script."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((s) => (
            <ScriptCard key={s.slug} script={s} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        pages={result.pages}
        query={{ q, placeId, sort: sort !== "newest" ? sort : undefined }}
      />
    </div>
  );
}
