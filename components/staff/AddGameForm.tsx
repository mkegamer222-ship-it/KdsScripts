"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddGameForm() {
  const router = useRouter();
  const [placeId, setPlaceId] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/staff/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setMsg({ type: "err", text: data?.error || "Falha ao cadastrar." });
      else {
        setMsg({ type: "ok", text: data.message || "Jogo cadastrado." });
        setPlaceId("");
        router.refresh();
      }
    } catch {
      setMsg({ type: "err", text: "Falha de conexão." });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
        Cadastrar jogo pelo Place ID
      </label>
      <div className="flex gap-2">
        <input
          className="input font-mono"
          placeholder="2753915549"
          inputMode="numeric"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "..." : "Cadastrar"}
        </button>
      </div>
      {msg && (
        <p
          className={`mt-2 rounded-xl border px-3 py-2 text-[12.5px] ${
            msg.type === "ok"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}
