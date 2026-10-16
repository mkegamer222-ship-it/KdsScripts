import { accentOf, initialsOf } from "@/lib/utils";

type Props = {
  script: {
    title?: string;
    gameName?: string;
    thumbnail?: string | null;
    gameThumbnail?: string | null;
    placeId?: number;
  };
  className?: string;
};

/** Capa do script: usa a thumbnail do jogo (Roblox) quando existir. */
export default function ScriptCover({ script, className = "aspect-video" }: Props) {
  const image = script.gameThumbnail || script.thumbnail;
  const seed = `${script.placeId ?? ""}${script.gameName ?? ""}${script.title ?? ""}`;
  const { colors } = accentOf(script.gameName || seed);
  const [c1, c2, c3] = colors;

  if (image) {
    return (
      <div className={`cover ${className}`} style={{ background: c3 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={script.gameName || script.title || "Capa do jogo"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`cover ${className}`}
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)` }}
    >
      <span className="relative z-10 text-[24px] text-white/95">
        {initialsOf(script.gameName || script.title || "KDS")}
      </span>
    </div>
  );
}
