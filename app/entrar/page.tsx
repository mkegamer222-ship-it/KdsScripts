"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function EntrarPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Não foi possível entrar.");
        setBusy(false);
        return;
      }
      await refresh();
      router.push("/conta");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[420px] pt-8">
      <h1 className="text-[26px] font-black tracking-tight text-white">Entrar</h1>
      <p className="mt-1.5 text-[13.5px] text-slate-400">
        Acesse para publicar scripts e acompanhar os seus envios.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-3 p-5">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">Usuário</label>
          <input
            className="input"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">Senha</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {error}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Entrando..." : "Entrar"}
        </button>

        <p className="pt-1 text-center text-[13px] text-slate-400">
          Não tem conta?{" "}
          <Link href="/criar-conta" className="font-semibold text-brand-400 hover:underline">
            Criar conta
          </Link>
        </p>
      </form>
    </div>
  );
}
