"use client";

import { useEffect, useState } from "react";
import { copyText } from "./CopyCodeButton";

/** Curtir + baixar .lua + compartilhar, em uma linha. */
export function RelationshipBar({
  slug,
  initialLikes,
  code,
}: {
  slug: string;
  initialLikes: number;
  code: string;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [shareMsg, setShareMsg] = useState("Compartilhar");
  const [viewed, setViewed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(`kds:like:${slug}`) === "1") setLiked(true);
    } catch {
      /* modo privado */
    }
  }, [slug]);

  // conta a visualização uma vez por sessão
  useEffect(() => {
    if (viewed) return;
    let already = false;
    try {
      already = sessionStorage.getItem(`kds:view:${slug}`) === "1";
      sessionStorage.setItem(`kds:view:${slug}`, "1");
    } catch {
      /* ignora */
    }
    setViewed(true);
    if (already) return;
    fetch(`/api/scripts/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => {});
  }, [slug, viewed]);

  async function like() {
    if (liked) return;
    setLiked(true);
    setLikes((n) => n + 1);
    try {
      localStorage.setItem(`kds:like:${slug}`, "1");
    } catch {
      /* ignora */
    }
    fetch(`/api/scripts/${encodeURIComponent(slug)}/like`, { method: "POST" }).catch(() => {});
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.lua`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    const url = `${window.location.origin}/scripts/${slug}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ url, title: document.title });
        return;
      } catch {
        /* cancelado */
      }
    }
    const ok = await copyText(url);
    setShareMsg(ok ? "Link copiado" : "Falhou");
    setTimeout(() => setShareMsg("Compartilhar"), 2000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={like} className={`btn ${liked ? "btn-ghost !text-brand-300" : "btn-dark"}`}>
        {liked ? "❤️ Curtido" : "🤍 Curtir"} {likes > 0 && `· ${likes}`}
      </button>
      <button onClick={download} className="btn btn-dark">
        ⬇ Baixar .lua
      </button>
      <button onClick={share} className="btn btn-dark">
        {shareMsg}
      </button>
    </div>
  );
}
