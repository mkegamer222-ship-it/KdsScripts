"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ScriptForm from "@/components/ScriptForm";
import { isStaff } from "@/lib/permissions";
import type { ScriptDoc } from "@/lib/types";

export default function EditarScriptPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [script, setScript] = useState<ScriptDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/entrar");
  }, [loading, user, router]);

  useEffect(() => {
    if (!params?.slug) return;
    fetch(`/api/my-scripts/${encodeURIComponent(params.slug)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setScript(d.script);
        else setError(d.error || "Script não encontrado.");
      })
      .catch(() => setError("Não foi possível carregar o script."));
  }, [params?.slug]);

  if (loading || !user) return <div className="skeleton mt-6 h-96 w-full rounded-2xl" />;

  if (error) {
    return (
      <div className="card mt-6 p-6 text-center">
        <p className="text-[14px] text-slate-300">{error}</p>
        <Link href="/conta" className="btn btn-primary mt-4">
          Voltar para a conta
        </Link>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="mt-6 space-y-3">
        <div className="skeleton h-9 w-64 rounded-xl" />
        <div className="skeleton h-[520px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <header>
        <nav className="flex items-center gap-2 text-[12px] text-slate-500">
          <Link href="/conta" className="hover:text-brand-400">
            Minha conta
          </Link>
          <span>/</span>
          <span className="text-slate-300">Editar script</span>
        </nav>
        <h1 className="mt-2 text-[26px] font-black tracking-tight text-white">Editar script</h1>
        <p className="mt-1.5 text-[13.5px] text-slate-400">
          Edições de membros voltam para a fila de análise da staff.
        </p>
      </header>

      <ScriptForm
        mode="edit"
        isStaff={isStaff(user.role)}
        initial={{
          slug: script.slug,
          title: script.title,
          description: script.description,
          code: script.code,
          version: script.version,
          keySystem: script.keySystem,
          tags: script.tags,
          features: script.features,
          placeId: script.placeId,
          gameName: script.gameName,
        }}
      />
    </div>
  );
}
