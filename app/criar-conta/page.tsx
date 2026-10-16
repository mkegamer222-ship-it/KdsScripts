"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function CriarContaPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Não foi possível criar a conta.");
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
      <h1 className="text-[26px] font-black tracking-tight text-white">Criar conta</h1>
      <p className="mt-1.5 text-[13.5px] text-slate-400">
        Com a conta você publica scripts e acompanha o status de cada envio.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-3 p-5">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">Usuário</label>
          <input
            className="input"
            autoComplete="username"
            placeholder="mínimo 3 caracteres"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Nome de exibição (opcional)
          </label>
          <input
            className="input"
            placeholder="como você quer aparecer nos scripts"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Senha
          </label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="mínimo 6 caracteres"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Confirmar senha
          </label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {error}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Criando..." : "Criar conta"}
        </button>

        <p className="pt-1 text-center text-[13px] text-slate-400">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-brand-400 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
