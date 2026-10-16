"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScriptListItem } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const QUICK = [
  "Blox Fruits",
  "Grow a Garden",
  "Pet Simulator 99",
  "Arsenal",
  "Doors",
  "Blue Lock Rivals",
  "Murder Mystery 2",
  "Universal",
];

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ScriptListItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/scripts?q=${encodeURIComponent(term)}&limit=6`);
        const json = await res.json();
        setItems(json.items || []);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 260);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit(term: string) {
    setOpen(false);
    router.push(term ? `/scripts?q=${encodeURIComponent(term)}` : "/scripts");
  }

  return (
    <div className="w-full" ref={boxRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q.trim());
        }}
        className="relative"
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => items.length && setOpen(true)}
            placeholder="Busque por script, jogo, hub ou executor..."
            aria-label="Buscar scripts"
            className="input !py-4 !pl-11 !pr-32 !text-[15px]"
            style={{ borderRadius: 16 }}
          />
          <button type="submit" className="btn btn-primary absolute right-2 top-1/2 -translate-y-1/2">
            Buscar
          </button>
        </div>

        {open && items.length > 0 && (
          <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e13] shadow-2xl">
            {items.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/scripts/${s.slug}`);
                }}
                className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-0 hover:bg-white/5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-400">
                  🎮
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-100">
                    {s.title}
                  </span>
                  <span className="block text-[11.5px] text-slate-500">
                    {s.gameName} · 👁 {formatNumber(s.views)}
                  </span>
                </span>
                <span className="chip chip-brand shrink-0">Abrir</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => submit(q.trim())}
              className="w-full bg-white/3 px-4 py-2.5 text-[12.5px] font-semibold text-brand-400 transition hover:bg-white/6"
            >
              Ver todos os resultados para “{q.trim()}” →
            </button>
          </div>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          Populares:
        </span>
        {QUICK.map((g) => (
          <button
            key={g}
            onClick={() => submit(g)}
            className="chip transition hover:border-brand-500/60 hover:text-brand-300"
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
