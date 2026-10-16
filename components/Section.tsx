import Link from "next/link";

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <span className="mb-1.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.18em] text-brand-500">
            <span className="h-1 w-6 rounded-full bg-brand-500" />
            {eyebrow}
          </span>
        )}
        <h2 className="text-[21px] font-extrabold tracking-tight text-white sm:text-[24px]">
          {title}
        </h2>
        {subtitle && <p className="mt-1 max-w-2xl text-[13.5px] text-slate-400">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="btn btn-ghost">
          {action.label} →
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <h3 className="text-[16px] font-bold text-slate-200">{title}</h3>
      {hint && <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-slate-400">{hint}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/enviar" className="btn btn-primary">
          Publicar script
        </Link>
        <Link href="/scripts" className="btn btn-dark">
          Ver todos os scripts
        </Link>
      </div>
    </div>
  );
}
