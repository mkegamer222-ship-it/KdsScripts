import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CodeBlock from "@/components/CodeBlock";
import ScriptCover from "@/components/ScriptCover";
import ScriptCard from "@/components/ScriptCard";
import { SectionTitle } from "@/components/Section";
import { RelationshipBar } from "@/components/ScriptActions";
import { getScript, relatedScripts } from "@/lib/data";
import { SITE } from "@/lib/config";
import { formatDate, formatNumber, timeAgo } from "@/lib/utils";
import { gameUrl } from "@/lib/roblox";

export const revalidate = 30;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const script = await getScript(slug, "approved");
  if (!script) return { title: "Script não encontrado" };
  return {
    title: script.title,
    description: script.description?.slice(0, 300) || `Script para ${script.gameName}.`,
    alternates: { canonical: `${SITE.url}/scripts/${script.slug}` },
  };
}

export default async function ScriptPage({ params }: Props) {
  const { slug } = await params;
  const script = await getScript(slug, "approved");
  if (!script) notFound();

  const related = await relatedScripts(script, 8);

  return (
    <div className="space-y-8 pt-4">
      <nav className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/" className="hover:text-brand-400">
          Início
        </Link>
        <span>/</span>
        <Link href="/scripts" className="hover:text-brand-400">
          Scripts
        </Link>
        <span>/</span>
        <Link href={`/jogos/${script.placeId}`} className="hover:text-brand-400">
          {script.gameName}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0 space-y-7">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/jogos/${script.placeId}`} className="chip chip-brand">
                {script.gameName}
              </Link>
              <span className="chip">v{script.version}</span>
              {script.keySystem ? (
                <span className="chip chip-yellow">com key</span>
              ) : (
                <span className="chip chip-blue">sem key</span>
              )}
            </div>

            <h1 className="mt-4 text-[26px] font-black leading-tight tracking-tight text-white sm:text-[33px]">
              {script.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-400">
              <span>por {script.authorName}</span>
              <span>👁 {formatNumber(script.views)}</span>
              <span>❤️ {formatNumber(script.likes)}</span>
              <span>📋 {formatNumber(script.copies)}</span>
              <span>atualizado {timeAgo(script.updatedAt || script.createdAt)}</span>
            </div>
          </header>

          <section>
            <h2 className="mb-3 text-[16px] font-extrabold text-white">Código</h2>
            <CodeBlock code={script.code} slug={script.slug} fileName={`${script.slug}.lua`} />
            <div className="mt-3">
              <RelationshipBar slug={script.slug} initialLikes={script.likes || 0} code={script.code} />
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-[16px] font-extrabold text-white">Descrição</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-300">
              {script.description || "O autor não adicionou descrição."}
            </p>

            {(script.features || []).length > 0 && (
              <>
                <h3 className="mt-6 text-[14px] font-bold text-slate-100">Funções</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {script.features.map((f) => (
                    <li
                      key={f}
                      className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-[13.2px] text-slate-300"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {(script.tags || []).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {script.tags.map((t) => (
                  <Link key={t} href={`/scripts?q=${encodeURIComponent(t)}`} className="chip hover:border-brand-500/60 hover:text-brand-300">
                    #{t}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-[16px] font-extrabold text-white">Como executar</h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  t: "Abra o jogo no Roblox",
                  d: `Entre em ${script.gameName} (Place ID ${script.placeId}) no PC ou no celular.`,
                },
                {
                  t: "Injete o executor",
                  d: "Abra o seu executor de escolha e aguarde a injeção concluir.",
                },
                {
                  t: "Cole e execute",
                  d: "Copie o código acima, cole na caixa do executor e execute.",
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-3.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-[13px] font-extrabold text-brand-400">
                    {i + 1}
                  </span>
                  <span>
                    <strong className="block text-[14px] font-bold text-slate-100">{s.t}</strong>
                    <span className="mt-0.5 block text-[13.2px] leading-relaxed text-slate-400">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-xl border border-white/10 bg-white/4 px-3.5 py-3 text-[12.5px] text-slate-400">
              Script de terceiros: revise o código antes de executar. O uso é por sua conta e risco.
            </p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card overflow-hidden p-4">
            <ScriptCover script={script} className="aspect-video w-full" />
            <a
              href={gameUrl(script.placeId)}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 block text-[15px] font-bold text-slate-100 hover:text-brand-300"
            >
              {script.gameName}
            </a>
            <p className="mt-0.5 font-mono text-[12px] text-slate-500">Place ID {script.placeId}</p>
          </div>

          <div className="card p-4">
            <h3 className="text-[14.5px] font-extrabold text-white">Informações</h3>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ["Autor", script.authorName],
                ["Versão", `v${script.version}`],
                ["Key", script.keySystem ? "Sim" : "Não"],
                ["Publicado", formatDate(script.createdAt)],
                ["Atualizado", formatDate(script.updatedAt || script.createdAt)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 last:border-0">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-semibold text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-4">
            <h3 className="text-[14.5px] font-extrabold text-white">Outros scripts deste jogo</h3>
            <Link href={`/jogos/${script.placeId}`} className="btn btn-dark mt-3 w-full">
              Ver scripts de {script.gameName}
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="pt-4">
          <SectionTitle title="Relacionados" subtitle="Do mesmo jogo ou do mesmo autor." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((s) => (
              <ScriptCard key={s.slug} script={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
