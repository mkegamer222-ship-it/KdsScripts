"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ScriptCover from "./ScriptCover";

type GameInfo = {
  placeId?: number;
  name?: string | null;
  creator?: string | null;
  thumbnail?: string | null;
  resolved?: boolean;
  error?: string;
};

type Initial = {
  slug?: string;
  title?: string;
  description?: string;
  code?: string;
  version?: string;
  keySystem?: boolean;
  tags?: string[];
  features?: string[];
  placeId?: number;
  gameName?: string;
};

export default function ScriptForm({
  mode,
  initial,
  isStaff,
}: {
  mode: "create" | "edit";
  initial?: Initial;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    code: initial?.code ?? "",
    version: initial?.version ?? "1.0.0",
    keySystem: initial?.keySystem ?? false,
    tags: (initial?.tags ?? []).join(", "),
    features: (initial?.features ?? []).join("\n"),
    placeId: initial?.placeId ? String(initial.placeId) : "",
  });

  const [game, setGame] = useState<GameInfo | null>(
    initial?.placeId ? { placeId: initial.placeId, name: initial.gameName, resolved: true } : null,
  );
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // consulta o jogo quando o Place ID muda (com debounce)
  useEffect(() => {
    const id = form.placeId.replace(/\D/g, "");
    if (id.length < 3) {
      setGame(null);
      return;
    }
    if (initial?.placeId && String(initial.placeId) === id) return;

    const timer = setTimeout(async () => {
      setLooking(true);
      try {
        const res = await fetch(`/api/game?placeId=${id}`, { cache: "no-store" });
        const data = await res.json();
        setGame(data.game ?? { error: data.error });
      } catch {
        setGame({ error: "Não foi possível consultar agora." });
      } finally {
        setLooking(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [form.placeId, initial?.placeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const payload = {
      ...(mode === "edit" ? { slug: initial?.slug } : {}),
      title: form.title,
      description: form.description,
      code: form.code,
      version: form.version,
      keySystem: form.keySystem,
      placeId: form.placeId.replace(/\D/g, ""),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
    };

    try {
      const res = await fetch(mode === "edit" ? "/api/my-scripts" : "/api/submit", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Não foi possível salvar.");
        setBusy(false);
        return;
      }
      setDone(
        isStaff
          ? "Script salvo e publicado."
          : "Script enviado. Ele fica em análise até um membro da staff aprovar.",
      );
      setBusy(false);
      router.refresh();
      if (mode === "create") {
        setForm({
          title: "", description: "", code: "", version: "1.0.0",
          keySystem: false, tags: "", features: "", placeId: "",
        });
        setGame(null);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="card space-y-4 p-5">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Place ID do jogo *
          </label>
          <div className="flex gap-2">
            <input
              className="input font-mono"
              placeholder="ex: 2753915549"
              inputMode="numeric"
              value={form.placeId}
              onChange={(e) => setForm({ ...form, placeId: e.target.value.replace(/\D/g, "") })}
              required
            />
            {looking && <span className="chip chip-blue self-center">consultando…</span>}
          </div>
          <p className="mt-1.5 text-[11.5px] text-slate-500">
            O Place ID é o número que aparece na URL do jogo:
            roblox.com/games/<span className="text-slate-300">2753915549</span>/nome-do-jogo
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Título do script *
          </label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="ex: Auto Farm de moedas"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">Descrição</label>
          <textarea
            className="input h-24 resize-none"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="O que o script faz, como configurar, limitações..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Código (Lua) *
          </label>
          <textarea
            className="input h-64 resize-y font-mono !text-[12.5px]"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="-- cole aqui o código do script"
            required
          />
          <p className="mt-1.5 text-[11.5px] text-slate-500">
            {form.code.length.toLocaleString("pt-BR")} caracteres
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">Versão</label>
            <input
              className="input"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-[13px] text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#ff6a1a]"
              checked={form.keySystem}
              onChange={(e) => setForm({ ...form, keySystem: e.target.checked })}
            />
            Precisa de key para rodar
          </label>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Tags (separadas por vírgula)
          </label>
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="auto farm, dinheiro, mobile"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-400">
            Funções (uma por linha)
          </label>
          <textarea
            className="input h-24 resize-none"
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            placeholder={"Auto farm\nTeleporte\nSalvar configuração"}
          />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
        <div className="card p-5">
          <h3 className="text-[15px] font-extrabold text-white">Jogo identificado</h3>

          {!form.placeId || form.placeId.length < 3 ? (
            <p className="mt-2 text-[13px] text-slate-400">
              Digite o Place ID para o site buscar o nome e a capa do jogo.
            </p>
          ) : game?.name ? (
            <div className="mt-3">
              <ScriptCover
                script={{ gameName: game.name, gameThumbnail: game.thumbnail, placeId: Number(form.placeId) }}
                className="aspect-video w-full"
              />
              <p className="mt-3 text-[15px] font-bold text-slate-100">{game.name}</p>
              <p className="text-[12px] text-slate-500">
                {game.creator ? `por ${game.creator} · ` : ""}Place ID {form.placeId}
              </p>
            </div>
          ) : game?.error ? (
            <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-200">
              Não consegui identificar esse Place ID agora. Você pode enviar assim mesmo — a staff
              confere antes de publicar.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="skeleton aspect-video w-full" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          )}

          {game?.name && !initial?.placeId && (
            <p className="mt-3 text-[11.5px] text-slate-500">
              Se este jogo ainda não estiver na lista, ele entra como pendente e a staff valida.
            </p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-[15px] font-extrabold text-white">Antes de enviar</h3>
          <ul className="mt-3 space-y-2 text-[12.8px] text-slate-400">
            <li>• Código completo, sem pedir dados da conta de ninguém.</li>
            <li>• Descreva o que o script faz e o que ele muda no jogo.</li>
            <li>• O Place ID precisa ser o do jogo em que o script funciona.</li>
          </ul>

          {error && (
            <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
              {error}
            </p>
          )}
          {done && (
            <p className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
              {done}
            </p>
          )}

          <button className="btn btn-primary mt-4 w-full" disabled={busy}>
            {busy ? "Enviando..." : mode === "edit" ? "Salvar alterações" : "Enviar script"}
          </button>
          <p className="mt-2 text-center text-[11.5px] text-slate-500">
            {isStaff
              ? "Envios da staff são publicados direto."
              : "Seu envio passa por revisão da staff antes de aparecer no site."}
          </p>
        </div>
      </aside>
    </form>
  );
}
