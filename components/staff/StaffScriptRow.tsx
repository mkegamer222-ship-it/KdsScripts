"use client";

import { useState } from "react";
import Link from "next/link";
import { reviewScriptAction } from "@/app/actions/staff";
import { timeAgo } from "@/lib/utils";
import type { ScriptDoc } from "@/lib/types";

export default function StaffScriptRow({ script }: { script: ScriptDoc }) {
  const [openCode, setOpenCode] = useState(false);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-yellow">pendente</span>
            <span className="chip">{script.gameName}</span>
            <span className="font-mono text-[11.5px] text-slate-500">ID {script.placeId}</span>
            <span className="text-[11.5px] text-slate-500">
              enviado por {script.authorName} · {timeAgo(script.createdAt)}
            </span>
          </div>

          <h3 className="mt-2 text-[15.5px] font-bold text-slate-100">{script.title}</h3>
          <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-slate-400">
            {script.description || "Sem descrição."}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
            <span>v{script.version}</span>
            <span>{script.keySystem ? "com key" : "sem key"}</span>
            <span>{script.code.length.toLocaleString("pt-BR")} caracteres de código</span>
            {script.tags?.length ? <span>#{script.tags.join(" #")}</span> : null}
          </div>
        </div>

        <button onClick={() => setOpenCode((v) => !v)} className="btn btn-dark !py-1.5 !text-[12.5px]">
          {openCode ? "Ocultar código" : "Ver código"}
        </button>
      </div>

      {openCode && (
        <pre className="code mt-3 max-h-80 overflow-auto rounded-xl border border-white/8 bg-[#060a08]">
          {script.code}
        </pre>
      )}

      <form action={reviewScriptAction} className="mt-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="slug" value={script.slug} />
        <input
          name="note"
          placeholder="observação para o autor (opcional)"
          className="input max-w-[320px] flex-1 !py-2 !text-[12.5px]"
        />
        <button name="decision" value="approve" className="btn btn-primary !py-2 !text-[12.5px]">
          Aprovar e publicar
        </button>
        <button
          name="decision"
          value="reject"
          className="btn btn-dark !py-2 !text-[12.5px] !text-rose-300"
        >
          Recusar
        </button>
        <Link href={`/enviar`} className="text-[12px] text-slate-500 underline hover:text-brand-400">
          ver formulário
        </Link>
      </form>
    </div>
  );
}
