"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import AuthUnavailable from "@/components/AuthUnavailable";
import ScriptForm from "@/components/ScriptForm";
import { isStaff } from "@/lib/permissions";

export default function EnviarPage() {
  const { user, loading, error, refresh } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !error && !user) router.replace("/entrar");
  }, [loading, error, user, router]);

  if (!user && error) return <AuthUnavailable onRetry={refresh} loading={loading} />;

  if (loading || !user) {
    return (
      <div className="space-y-4 pt-6">
        <div className="skeleton h-9 w-64 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="skeleton h-[520px] w-full rounded-2xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <header>
        <nav className="flex items-center gap-2 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-brand-400">
            Início
          </Link>
          <span>/</span>
          <span className="text-slate-300">Publicar script</span>
        </nav>
        <h1 className="mt-2 text-[28px] font-black tracking-tight text-white sm:text-[34px]">
          Publicar script
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] text-slate-400">
          Informe o Place ID do jogo e cole o código. Envios de membros ficam em análise até um
          membro da staff aprovar; jogos novos também são validados antes de aparecer na lista.
        </p>
      </header>

      <ScriptForm mode="create" isStaff={isStaff(user.role)} />
    </div>
  );
}
