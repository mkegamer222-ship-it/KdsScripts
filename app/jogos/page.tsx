import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, SectionTitle } from "@/components/Section";
import { listGames } from "@/lib/data";
import { accentOf, formatNumber, initialsOf } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Jogos",
  description: "Jogos cadastrados pelo Place ID e validados pela staff.",
};

export default async function JogosPage() {
  const games = await listGames({ limit: 120, status: "approved" });

  return (
    <div className="space-y-8 pt-4">
      <header>
        <nav className="flex items-center gap-2 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-brand-400">
            Início
          </Link>
          <span>/</span>
          <span className="text-slate-300">Jogos</span>
        </nav>
        <h1 className="mt-2 text-[28px] font-black tracking-tight text-white sm:text-[34px]">Jogos</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] text-slate-400">
          Cada jogo é identificado pelo Place ID e só aparece aqui depois da validação da staff.
        </p>
      </header>

      {games.items.length === 0 ? (
        <EmptyState
          title="Nenhum jogo validado ainda"
          hint="Ao publicar um script, informe o Place ID do jogo: ele entra na fila de validação da staff e, quando aprovado, aparece nesta lista."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {games.items.map((g) => {
              const { colors } = accentOf(g.name);
              return (
                <Link
                  key={g.placeId}
                  href={`/jogos/${g.placeId}`}
                  className="card card-hover overflow-hidden p-0"
                >
                  {g.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.thumbnail}
                      alt={g.name}
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="grid aspect-video w-full place-items-center text-[20px] font-black text-white"
                      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[2]})` }}
                    >
                      {initialsOf(g.name)}
                    </div>
                  )}
                  <div className="p-3.5">
                    <p className="truncate text-[14.5px] font-bold text-slate-100">{g.name}</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-slate-500">ID {g.placeId}</p>
                    <p className="mt-1 text-[12px] text-slate-400">
                      {g.scriptCount ?? 0} {g.scriptCount === 1 ? "script" : "scripts"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <SectionTitle
            title="Como um jogo entra na lista"
            subtitle="O jogo é criado automaticamente quando alguém publica um script informando o Place ID. A staff confere o nome e valida antes de aparecer publicamente."
          />
        </>
      )}
    </div>
  );
}
