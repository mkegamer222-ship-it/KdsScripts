import Link from "next/link";

export default function Pagination({
  page,
  pages,
  basePath = "/scripts",
  query = {},
}: {
  page: number;
  pages: number;
  basePath?: string;
  query?: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  function hrefFor(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  }

  const nums: number[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, from + 4);
  for (let i = from; i <= to; i++) nums.push(i);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Paginação">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="btn btn-dark">
          ← Anterior
        </Link>
      )}
      {nums.map((n) => (
        <Link key={n} href={hrefFor(n)} className={`btn !px-3.5 ${n === page ? "btn-primary" : "btn-dark"}`}>
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link href={hrefFor(page + 1)} className="btn btn-dark">
          Próxima →
        </Link>
      )}
    </nav>
  );
}
