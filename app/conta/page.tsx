"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import AuthUnavailable from "@/components/AuthUnavailable";
import { formatDate, formatNumber } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import type { ScriptListItem } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  pending: "chip-yellow",
  approved: "chip-green",
  rejected: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  approved: "Publicado",
  rejected: "Recusado",
};

export default function ContaPage() {
  const { user, loading, error, refresh } = useAuth();
  const router = useRouter();
  const [scripts, setScripts] = useState<ScriptListItem[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busting, setBusting] = useState(false);

  useEffect(() => {
    if (!loading && !error && !user) router.replace("/entrar");
  }, [loading, error, user, router]);

  const loadScripts = useCallback(async () => {
    if (!user) return;
    setLoadingScripts(true);
    try {
      const res = await fetch("/api/my-scripts", { cache: "no-store" });
      const data = await res.json();
      setScripts(data.items ?? []);
    } catch {
      setScripts([]);
    } finally {
      setLoadingScripts(false);
    }
  }, [user]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  async function remove(slug: string) {
    if (!confirm("Remover este script?")) return;
    const res = await fetch(`/api/my-scripts/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (res.ok) {
      setNotice("Script removido.");
      loadScripts();
      refresh();
    }
  }

  if (!user && error) return <AuthUnavailable onRetry={refresh} loading={loading} />;

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-[760px] space-y-4 pt-8">
        <div className="skeleton h-9 w-56 rounded-xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const totalViews = scripts.reduce((a, s) => a + (s.views || 0), 0);
  const totalLikes = scripts.reduce((a, s) => a + (s.likes || 0), 0);

  return (
    <div className="mx-auto max-w-[860px] space-y-6 pt-6">
      <header className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/15 text-[18px] font-black text-brand-300">
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-black tracking-tight text-white">{user.username}</h1>
          <p className="text-[12.5px] text-slate-400">
            {roleLabel(user.role)}
            {user.createdAt ? ` · membro desde ${formatDate(user.createdAt)}` : ""}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/enviar" className="btn btn-primary">
            Publicar script
          </Link>
          {(user.role === "staff" || user.role === "owner") && (
            <Link href="/staff" className="btn btn-ghost">
              Painel da staff
            </Link>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Scripts", v: scripts.length },
          { k: "Views", v: totalViews },
          { k: "Curtidas", v: totalLikes },
          {
            k: "Publicados",
            v: scripts.filter((s) => s.status === "approved").length,
          },
        ].map((s) => (
          <div key={s.k} className="card p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{s.k}</div>
            <div className="mt-1 text-[20px] font-extrabold text-white">{formatNumber(s.v)}</div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="text-[16px] font-extrabold text-white">Trocar senha</h2>
        <PasswordForm onDone={() => setNotice("Senha alterada.")} />
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-extrabold text-white">Meus scripts</h2>
          <button
            onClick={() => {
              setNotice(null);
              loadScripts();
            }}
            className="btn btn-dark !py-1.5 !text-[12.5px]"
            disabled={busting}
          >
            Atualizar lista
          </button>
        </div>

        {notice && (
          <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            {notice}
          </p>
        )}

        {loadingScripts ? (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : scripts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/8 bg-white/3 px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-300">
              Você ainda não publicou nenhum script.
            </p>
            <Link href="/enviar" className="btn btn-primary mt-4">
              Publicar o primeiro
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {scripts.map((s) => (
              <li
                key={s.slug}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`chip ${STATUS_STYLE[s.status] ?? "chip"}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <span className="truncate text-[14px] font-semibold text-slate-100">
                      {s.title}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11.5px] text-slate-500">
                    {s.gameName} · ID {s.placeId} · 👁 {formatNumber(s.views)} ·{" "}
                    {formatDate(s.updatedAt || s.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  {s.status === "approved" && (
                    <Link
                      href={`/scripts/${s.slug}`}
                      className="btn btn-dark !px-2.5 !py-1.5 !text-[12px]"
                    >
                      abrir
                    </Link>
                  )}
                  <Link
                    href={`/conta/editar/${s.slug}`}
                    className="btn btn-dark !px-2.5 !py-1.5 !text-[12px]"
                  >
                    editar
                  </Link>
                  <button
                    onClick={() => remove(s.slug)}
                    className="btn btn-dark !px-2.5 !py-1.5 !text-[12px] !text-rose-300"
                  >
                    remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setError("A confirmação não confere.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: form.current, next: form.next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Não foi possível alterar a senha.");
      } else {
        setForm({ current: "", next: "", confirm: "" });
        onDone();
      }
    } catch {
      setError("Falha de conexão.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-3">
      <input
        className="input"
        type="password"
        placeholder="senha atual"
        autoComplete="current-password"
        value={form.current}
        onChange={(e) => setForm({ ...form, current: e.target.value })}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="nova senha"
        autoComplete="new-password"
        value={form.next}
        onChange={(e) => setForm({ ...form, next: e.target.value })}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="confirmar nova senha"
        autoComplete="new-password"
        value={form.confirm}
        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        required
      />
      {error && (
        <p className="sm:col-span-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {error}
        </p>
      )}
      <button className="btn btn-primary sm:col-span-3" disabled={busy}>
        {busy ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
