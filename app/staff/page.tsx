import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getStats, listGames, listScripts, listScriptsWithCode, listUsers } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import StaffScriptRow from "@/components/staff/StaffScriptRow";
import StaffGameRow from "@/components/staff/StaffGameRow";
import StaffUserRow from "@/components/staff/StaffUserRow";
import AddGameForm from "@/components/staff/AddGameForm";
import { deleteScriptAsStaffAction } from "@/app/actions/staff";

export const dynamic = "force-dynamic";

export const metadata = { title: "Painel da staff" };

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!isStaff(user.role)) redirect("/conta");

  const [pendingScripts, pendingGames, allGames, users, approved, stats] = await Promise.all([
    listScriptsWithCode({ status: "pending", limit: 50 }),
    listGames({ status: "pending", limit: 50 }),
    listGames({ status: "all", limit: 60 }),
    listUsers(100),
    listScripts({ status: "approved", limit: 24 }),
    getStats(),
  ]);

  const isOwnerUser = user.role === "owner";

  return (
    <div className="space-y-10 pt-4">
      <header className="card flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
            Painel da staff · {roleLabel(user.role)}
          </p>
          <h1 className="mt-1 text-[24px] font-black tracking-tight text-white">
            Olá, {user.username}
          </h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Aprove scripts e valide jogos. Tudo que é aprovado aparece no site imediatamente.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/enviar" className="btn btn-primary">
            Publicar script
          </Link>
          <Link href="/scripts" className="btn btn-ghost">
            Ver site
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: "Scripts", v: stats.scripts },
          { k: "Jogos", v: stats.games },
          { k: "Contas", v: stats.users },
          { k: "Views", v: stats.views },
          { k: "Scripts na fila", v: stats.pendingScripts },
          { k: "Jogos na fila", v: stats.pendingGames },
        ].map((s) => (
          <div key={s.k} className="card p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{s.k}</div>
            <div className="mt-1 text-[20px] font-extrabold text-white">{formatNumber(s.v)}</div>
          </div>
        ))}
      </section>

      {/* ---------------- Fila de scripts ---------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-extrabold text-white">
              Fila de scripts{" "}
              <span className="text-slate-500">({pendingScripts.length})</span>
            </h2>
            <p className="mt-1 text-[13px] text-slate-400">
              Revise o código antes de aprovar. Recusar deixa o script invisível no site.
            </p>
          </div>
        </div>

        {pendingScripts.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <p className="text-[14px] text-slate-300">Nada na fila.</p>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Novos envios da comunidade aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingScripts.map((s) => (
              <StaffScriptRow key={s.slug} script={s} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Fila de jogos ---------------- */}
      <section>
        <div className="mb-4">
          <h2 className="text-[19px] font-extrabold text-white">
            Jogos para validar <span className="text-slate-500">({pendingGames.items.length})</span>
          </h2>
          <p className="mt-1 text-[13px] text-slate-400">
            Confira se o Place ID e o nome batem com o jogo. Sem validação, o jogo não aparece na
            lista pública.
          </p>
        </div>

        {pendingGames.items.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <p className="text-[14px] text-slate-300">Nenhum jogo esperando validação.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingGames.items.map((g) => (
              <StaffGameRow key={g.placeId} game={g} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Jogos cadastrados ---------------- */}
      <section>
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <h2 className="text-[19px] font-extrabold text-white">Jogos cadastrados</h2>
            <p className="mt-1 text-[13px] text-slate-400">
              Nome, status e correção manual do nome exibido.
            </p>
          </div>
          <AddGameForm />
        </div>

        <div className="card divide-y divide-white/6">
          {allGames.items.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">
              Nenhum jogo cadastrado.
            </p>
          )}
          {allGames.items.map((g) => (
            <StaffGameRow key={`all-${g.placeId}`} game={g} compact />
          ))}
        </div>
      </section>

      {/* ---------------- Scripts publicados ---------------- */}
      <section>
        <h2 className="mb-4 text-[19px] font-extrabold text-white">
          Scripts publicados <span className="text-slate-500">({approved.total})</span>
        </h2>
        <div className="card divide-y divide-white/6">
          {approved.items.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">
              Nenhum script publicado ainda.
            </p>
          )}
          {approved.items.map((s) => (
            <div key={s.slug} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/scripts/${s.slug}`}
                  className="truncate text-[14px] font-semibold text-slate-100 hover:text-brand-300"
                >
                  {s.title}
                </Link>
                <p className="truncate text-[11.5px] text-slate-500">
                  {s.gameName} · ID {s.placeId} · por {s.authorName} · 👁 {formatNumber(s.views)} ·{" "}
                  {formatDate(s.updatedAt || s.createdAt)}
                </p>
              </div>
              <form action={deleteScriptAsStaffAction}>
                <input type="hidden" name="slug" value={s.slug} />
                <button className="btn btn-dark !px-2.5 !py-1.5 !text-[12px] !text-rose-300">
                  excluir
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Contas ---------------- */}
      <section>
        <div className="mb-4">
          <h2 className="text-[19px] font-extrabold text-white">
            Contas <span className="text-slate-500">({users.length})</span>
          </h2>
          <p className="mt-1 text-[13px] text-slate-400">
            {isOwnerUser
              ? "Como dono, você pode promover membros a staff e suspender contas."
              : "Somente o dono pode alterar cargos e suspender contas."}
          </p>
        </div>

        <div className="card divide-y divide-white/6">
          {users.map((u) => (
            <StaffUserRow key={u.id} user={u} canManage={isOwnerUser} />
          ))}
        </div>
      </section>
    </div>
  );
}
