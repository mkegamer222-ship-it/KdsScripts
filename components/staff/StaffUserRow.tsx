import { setUserRoleAction, toggleUserBanAction } from "@/app/actions/staff";
import { formatDate } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import type { PublicUser } from "@/lib/types";

export default function StaffUserRow({
  user,
  canManage,
}: {
  user: PublicUser;
  canManage: boolean;
}) {
  const nextRole = user.role === "staff" ? "user" : "staff";

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-[12px] font-bold text-slate-300">
        {user.username.slice(0, 2).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-slate-100">{user.username}</span>
          <span
            className={`chip ${
              user.role === "owner" ? "chip-brand" : user.role === "staff" ? "chip-green" : ""
            }`}
          >
            {roleLabel(user.role)}
          </span>
          {user.banned && <span className="chip chip-blue">suspenso</span>}
        </div>
        <p className="mt-0.5 text-[11.5px] text-slate-500">
          desde {formatDate(user.createdAt)}
        </p>
      </div>

      {canManage && user.role !== "owner" ? (
        <div className="flex flex-wrap gap-2">
          <form action={setUserRoleAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="role" value={nextRole} />
            <button className="btn btn-dark !px-2.5 !py-1.5 !text-[12px]">
              {user.role === "staff" ? "remover staff" : "promover a staff"}
            </button>
          </form>
          <form action={toggleUserBanAction}>
            <input type="hidden" name="userId" value={user.id} />
            <button className="btn btn-dark !px-2.5 !py-1.5 !text-[12px] !text-rose-300">
              {user.banned ? "reativar conta" : "suspender"}
            </button>
          </form>
        </div>
      ) : (
        <span className="text-[11.5px] text-slate-600">
          {user.role === "owner" ? "acesso total" : canManage ? "" : "só o dono altera"}
        </span>
      )}
    </div>
  );
}
