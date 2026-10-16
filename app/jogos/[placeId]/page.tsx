import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ScriptCard from "@/components/ScriptCard";
import Pagination from "@/components/Pagination";
import { EmptyState } from "@/components/Section";
import { getGame, listScripts } from "@/lib/data";
import { gameUrl } from "@/lib/roblox";
import { formatNumber } from "@/lib/utils";

export const revalidate = 60;

type Props = {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { placeId } = await params;
  const game = await getGame(placeId, "approved");
  return {
    title: game?.name || "Jogo",
    description: game
      ? `Scripts publicados para ${game.name} (Place ID ${game.placeId}).`
      : "Jogo não encontrado.",
  };
}

export default async function JogoPage({ params, searchParams }: Props) {
  const { placeId } = await params;
  const sp = await searchParams;
  const page = Number((Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const game = await getGame(placeId, "approved");
  if (!game) notFound();

  const result = await listScripts({ placeId: game.placeId, page, limit: 12 });

  return (
    <div className="space-y-7 pt-4">
      <header className="card overflow-hidden p-0">
        <div className="grid gap-5 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
          {game.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.thumbnail}
              alt={game.name}
              className="aspect-video w-full rounded-xl object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center rounded-xl bg-white/5 text-[13px] text-slate-500">
              sem capa
            </div>
          )}

          <div className="min-w-0">
            <nav className="flex items-center gap-2 text-[12px] text-slate-500">
              <Link href="/jogos" className="hover:text-brand-400">
                Jogos
              </Link>
              <span>/</span>
              <span className="truncate text-slate-300">{game.name}</span>
            </nav>

            <h1 className="mt-2 text-[26px] font-black tracking-tight text-white sm:text-[32px]">
              {game.name}
            </h1>
            <p className="mt-1.5 font-mono text-[12.5px] text-slate-500">
              Place ID {game.placeId}
              {game.creator ? ` · por ${game.creator}` : ""}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip chip-green">validado pela staff</span>
              <span className="chip">{result.total} scripts</span>
              {typeof game.updatedAt === "string" && (
                <span className="chip">atualizado {new Date(game.updatedAt).toLocaleDateString("pt-BR")}</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={gameUrl(game.placeId)}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-ghost"
              >
                Abrir na Roblox ↗
              </a>
              <Link href={`/scripts?placeId=${game.placeId}`} className="btn btn-dark">
                Filtrar na lista
              </Link>
            </div>

            {game.reviewedBy && (
              <p className="mt-3 text-[11.5px] text-slate-500">
                Validação feita por {game.reviewedBy}
                {game.reviewNote ? ` — ${game.reviewNote}` : ""}
              </p>
            )}
          </div>
        </div>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          title="Nenhum script publicado para este jogo"
          hint="Você pode publicar o primeiro script deste jogo informando este Place ID."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((s) => (
            <ScriptCard key={s.slug} script={s} />
          ))}
        </div>
      )}

      <Pagination page={result.page} pages={result.pages} basePath={`/jogos/${game.placeId}`} />

      <p className="text-[11.5px] text-slate-600">
        Visualizações totais deste jogo:{" "}
        {formatNumber(result.items.reduce((a, s) => a + (s.views || 0), 0))}
      </p>
    </div>
  );
}
