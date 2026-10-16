import Link from "next/link";
import ScriptCover from "./ScriptCover";
import CopyCodeButton from "./CopyCodeButton";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { ScriptListItem } from "@/lib/types";

export default function ScriptCard({ script }: { script: ScriptListItem }) {
  return (
    <article className="card card-hover group flex flex-col overflow-hidden p-3">
      <Link href={`/scripts/${script.slug}`} className="relative block">
        <ScriptCover script={script} className="aspect-video w-full" />
        <div className="absolute left-2 top-2 z-10">
          {script.keySystem ? (
            <span className="chip chip-yellow">com key</span>
          ) : (
            <span className="chip chip-blue">sem key</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
          <span className="truncate font-mono text-[11px]">ID {script.placeId}</span>
          <span className="text-slate-700">•</span>
          <span className="truncate">{script.gameName}</span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-bold leading-snug text-slate-100 transition group-hover:text-brand-300">
          <Link href={`/scripts/${script.slug}`}>{script.title}</Link>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-[12.8px] leading-relaxed text-slate-400">
          {script.description || "Sem descrição."}
        </p>

        {(script.tags || []).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {script.tags.slice(0, 3).map((t) => (
              <Link
                key={t}
                href={`/scripts?q=${encodeURIComponent(t)}`}
                className="rounded-md border border-white/8 bg-white/4 px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:border-brand-500/50 hover:text-brand-300"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11.5px] text-slate-500">
          <span>👁 {formatNumber(script.views)}</span>
          <span>❤️ {formatNumber(script.likes)}</span>
          <span>📋 {formatNumber(script.copies)}</span>
          <span className="ml-auto truncate">por {script.authorName}</span>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
          <CopyCodeButton slug={script.slug} label="Copiar" className="flex-1 !py-2 !text-[13px]" />
          <Link href={`/scripts/${script.slug}`} className="btn btn-dark !py-2 !text-[13px]">
            Abrir
          </Link>
        </div>

        <p className="mt-2 text-[11px] text-slate-600">
          atualizado {timeAgo(script.updatedAt || script.createdAt)}
        </p>
      </div>
    </article>
  );
}
