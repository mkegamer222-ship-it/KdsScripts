import Link from "next/link";
import { SITE } from "@/lib/config";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/8 bg-black/40">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black text-white"
              style={{ background: "linear-gradient(135deg,#ff8f3c,#e5540d)" }}
            >
              K
            </span>
            <span className="text-[14.5px] font-extrabold tracking-tight text-white">
              KDS<span className="text-brand-500">SCRIPTS</span>
            </span>
          </div>
          <p className="mt-2.5 max-w-md text-[12.5px] leading-relaxed text-slate-500">
            {SITE.footerNote}
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          <Link href="/scripts" className="text-slate-400 transition hover:text-brand-400">
            Scripts
          </Link>
          <Link href="/jogos" className="text-slate-400 transition hover:text-brand-400">
            Jogos
          </Link>
          <Link href="/enviar" className="text-slate-400 transition hover:text-brand-400">
            Publicar
          </Link>
          <Link href="/conta" className="text-slate-400 transition hover:text-brand-400">
            Minha conta
          </Link>
        </nav>

        <p className="text-[12px] text-slate-600">© {year} {SITE.name}</p>
      </div>
    </footer>
  );
}
