import Link from "next/link";
import ScriptCard from "@/components/ScriptCard";
import HeroSearch from "@/components/HeroSearch";
import { EmptyState, SectionTitle } from "@/components/Section";
import { getStats, listGames, listScripts } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import { accentOf, initialsOf } from "@/lib/utils";

export const revalidate = 30;

export default async function HomePage() {
  const [stats, latest, games] = await Promise.all([
    getStats(),
    listScripts({ sort: "newest", limit: 8 }),
    listGames({ limit: 12 }),
  ]);

  return (
    <div className="space-y-14">
      <section className="pt-8">
        <h1 className="max-w-3xl text-[32px] font-black leading-[1.08] tracking-tight text-white sm:text-[44px]">
          Scripts publicados pela comunidade
        </h1>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-slate-400">
          Cada script aqui traz o jogo identificado pelo Place ID e o nome de quem publicou. Envios
          de membros passam por revisão da staff antes de aparecer na lista.
        </p>

        <div className="mt-7 max-w-2xl">
          <HeroSearch />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Scripts publicados", v: formatNumber(stats.scripts) },
            { k: "Jogos validados", v: formatNumber(stats.games) },
            { k: "Visualizações", v: formatNumber(stats.views) },
            { k: "Contas", v: formatNumber(stats.users) },
          ].map((s) => (
            <div key={s.k} className="card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {s.k}
              </div>
              <div className="mt-1 text-[20px] font-extrabold text-white">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/enviar" className="btn btn-primary">
            Publicar script
          </Link>
          <Link href="/scripts" className="btn btn-ghost">
            Ver todos os scripts
          </Link>
        </div>
      </section>

      <section>
        <SectionTitle
          title="Scripts recentes"
          subtitle="Últimos scripts aprovados pela staff."
          action={{ href: "/scripts", label: "Ver todos" }}
        />
        {latest.items.length === 0 ? (
          <EmptyState
            title="Nenhum script publicado ainda"
            hint="A biblioteca começa vazia. Publique o primeiro script para ele aparecer aqui depois da revisão da staff."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latest.items.map((s) => (
              <ScriptCard key={s.slug} script={s} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title="Jogos validados"
          subtitle="Jogos cadastrados pelo Place ID e conferidos pela staff."
          action={{ href: "/jogos", label: "Ver jogos" }}
        />
        {games.items.length === 0 ? (
          <div className="card px-5 py-8 text-center">
            <p className="text-[14px] text-slate-300">Nenhum jogo validado ainda.</p>
            <p className="mt-1.5 text-[13px] text-slate-500">
              Ao publicar um script, o Place ID informado cria o jogo e entra na fila de validação.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {games.items.map((g) => {
              const { colors } = accentOf(g.name);
              return (
                <Link
                  key={g.placeId}
                  href={`/jogos/${g.placeId}`}
                  className="card card-hover flex items-center gap-3 p-3.5"
                >
                  {g.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.thumbnail}
                      alt={g.name}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-black text-white"
                      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[2]})` }}
                    >
                      {initialsOf(g.name)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold text-slate-100">
                      {g.name}
                    </span>
                    <span className="block text-[11.5px] text-slate-500">
                      {g.scriptCount ?? 0} scripts · ID {g.placeId}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            t: "1. Crie a conta",
            d: "O cadastro pede usuário e senha. A sessão fica salva por 30 dias no seu navegador.",
          },
          {
            t: "2. Informe o Place ID",
            d: "O site consulta o Place ID na API pública da Roblox para preencher o nome e a capa do jogo.",
          },
          {
            t: "3. Revisão da staff",
            d: "Scripts e jogos novos entram como pendentes e só ficam visíveis depois da aprovação.",
          },
        ].map((s) => (
          <div key={s.t} className="card p-5">
            <h3 className="text-[15px] font-extrabold text-white">{s.t}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{s.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
