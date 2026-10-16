"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { destroySessionAndRedirect } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/types";
import { isStaff } from "@/lib/permissions";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/scripts", label: "Scripts" },
  { href: "/jogos", label: "Jogos" },
  { href: "/enviar", label: "Publicar script" },
];

function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");

  useEffect(() => {
    try {
      setValue(new URLSearchParams(window.location.search).get("q") ?? "");
    } catch {
      setValue("");
    }
  }, [pathname]);

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/scripts?q=${encodeURIComponent(q)}` : "/scripts");
      }}
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar script, jogo ou autor"
          aria-label="Buscar scripts"
          className="input pl-9 pr-14"
        />
      </div>
    </form>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setUser(d.user ?? null))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [pathname]);

  const staff = user ? isStaff(user.role) : false;

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#07080b]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-[15px] font-black text-white"
            style={{ background: "linear-gradient(135deg,#ff8f3c,#e5540d)" }}
          >
            K
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-white">
            KDS<span className="text-brand-500">SCRIPTS</span>
          </span>
        </Link>

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-[13.5px] font-semibold transition ${
                  active ? "bg-white/8 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {staff && (
            <Link
              href="/staff"
              className={`rounded-lg px-3 py-2 text-[13.5px] font-semibold transition ${
                pathname.startsWith("/staff")
                  ? "bg-brand-500/15 text-brand-300"
                  : "text-brand-400 hover:bg-white/5"
              }`}
            >
              Staff
            </Link>
          )}
        </nav>

        <div className="ml-auto hidden max-w-[280px] flex-1 md:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          {!loaded ? (
            <div className="skeleton h-9 w-24 rounded-xl" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="btn btn-ghost"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/25 text-[10px] font-bold text-brand-300">
                  {user.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="max-w-[90px] truncate">{user.username}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0b0e13] py-1 shadow-2xl">
                  <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">
                    {user.role === "owner" ? "Dono" : user.role === "staff" ? "Staff" : "Membro"}
                  </div>
                  <Link href="/conta" className="block px-3 py-2 text-[13.5px] text-slate-200 hover:bg-white/5">
                    Minha conta
                  </Link>
                  <Link href="/enviar" className="block px-3 py-2 text-[13.5px] text-slate-200 hover:bg-white/5">
                    Publicar script
                  </Link>
                  {staff && (
                    <Link href="/staff" className="block px-3 py-2 text-[13.5px] text-brand-300 hover:bg-white/5">
                      Painel da staff
                    </Link>
                  )}
                  <form action={destroySessionAndRedirect}>
                    <button className="w-full border-t border-white/8 px-3 py-2 text-left text-[13.5px] text-rose-300 hover:bg-white/5">
                      Sair
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/entrar" className="btn btn-ghost">
                Entrar
              </Link>
              <Link href="/criar-conta" className="hidden btn btn-primary sm:inline-flex">
                Criar conta
              </Link>
            </>
          )}

          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            className="btn btn-ghost lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              {mobileOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/8 bg-[#0a0c11] px-4 py-4 lg:hidden">
          <SearchBox className="mb-3 md:hidden" />
          <div className="grid grid-cols-2 gap-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm font-semibold text-slate-300"
              >
                {item.label}
              </Link>
            ))}
            {staff && (
              <Link
                href="/staff"
                className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 text-sm font-semibold text-brand-300"
              >
                Painel da staff
              </Link>
            )}
            {user ? (
              <Link href="/conta" className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm font-semibold text-slate-300">
                Minha conta
              </Link>
            ) : (
              <>
                <Link href="/entrar" className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm font-semibold text-slate-300">
                  Entrar
                </Link>
                <Link href="/criar-conta" className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm font-semibold text-slate-300">
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
