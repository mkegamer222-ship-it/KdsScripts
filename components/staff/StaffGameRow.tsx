import { reviewGameAction, updateGameNameAction } from "@/app/actions/staff";
import { gameUrl } from "@/lib/roblox";
import { timeAgo } from "@/lib/utils";
import type { GameListItem } from "@/lib/types";

const STATUS_CHIP: Record<string, string> = {
  pending: "chip-yellow",
  approved: "chip-green",
  rejected: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "pendente",
  approved: "validado",
  rejected: "recusado",
};

export default function StaffGameRow({
  game,
  compact = false,
}: {
  game: GameListItem;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`chip ${STATUS_CHIP[game.status] ?? "chip"}`}>
              {STATUS_LABEL[game.status] ?? game.status}
            </span>
            <span className="truncate text-[14px] font-semibold text-slate-100">{game.name}</span>
          </div>
          <p className="mt-0.5 font-mono text-[11.5px] text-slate-500">
            ID {game.placeId}
            {game.creator ? ` · ${game.creator}` : ""} · {game.scriptCount ?? 0} scripts
          </p>
        </div>

        <form action={updateGameNameAction} className="flex items-center gap-2">
          <input type="hidden" name="placeId" value={game.placeId} />
          <input
            name="name"
            defaultValue={game.name}
            className="input max-w-[220px] !py-1.5 !text-[12.5px]"
          />
          <button className="btn btn-dark !px-2.5 !py-1.5 !text-[12px]">salvar nome</button>
        </form>

        {game.status === "pending" ? (
          <form action={reviewGameAction} className="flex gap-2">
            <input type="hidden" name="placeId" value={game.placeId} />
            <button name="decision" value="approve" className="btn btn-primary !px-3 !py-1.5 !text-[12px]">
              validar
            </button>
            <button name="decision" value="reject" className="btn btn-dark !px-3 !py-1.5 !text-[12px] !text-rose-300">
              recusar
            </button>
          </form>
        ) : (
          <a
            href={gameUrl(game.placeId)}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-dark !px-2.5 !py-1.5 !text-[12px]"
          >
            abrir ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-start gap-4 p-4">
      {game.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.thumbnail}
          alt={game.name}
          className="h-20 w-36 shrink-0 rounded-xl object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="grid h-20 w-36 shrink-0 place-items-center rounded-xl bg-white/5 text-[11.5px] text-slate-500">
          sem capa
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${STATUS_CHIP[game.status] ?? "chip"}`}>
            {STATUS_LABEL[game.status] ?? game.status}
          </span>
          <span className="font-mono text-[11.5px] text-slate-500">ID {game.placeId}</span>
          {game.submittedBy && (
            <span className="text-[11.5px] text-slate-500">
              enviado por {game.submittedBy} · {timeAgo(game.createdAt)}
            </span>
          )}
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold text-slate-100">{game.name}</h3>
        {game.creator && <p className="text-[12.5px] text-slate-500">criador: {game.creator}</p>}

        <form action={reviewGameAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="placeId" value={game.placeId} />
          <input
            name="note"
            placeholder="observação (opcional)"
            className="input max-w-[260px] flex-1 !py-2 !text-[12.5px]"
          />
          <button name="decision" value="approve" className="btn btn-primary !py-2 !text-[12.5px]">
            Validar jogo
          </button>
          <button name="decision" value="reject" className="btn btn-dark !py-2 !text-[12.5px] !text-rose-300">
            Recusar
          </button>
          <a
            href={gameUrl(game.placeId)}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[12px] text-slate-500 underline hover:text-brand-400"
          >
            conferir na Roblox ↗
          </a>
        </form>
      </div>
    </div>
  );
}
