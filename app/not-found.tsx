import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <span className="text-5xl">🧭</span>
      <h1 className="mt-4 text-[28px] font-black text-white">Página não encontrada</h1>
      <p className="mt-2 max-w-lg text-[14px] text-slate-400">
        O endereço não existe, ou o conteúdo saiu do ar (jogos e scripts precisam estar aprovados
        para aparecer).
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/scripts" className="btn btn-primary">
          Ver scripts
        </Link>
        <Link href="/" className="btn btn-dark">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
