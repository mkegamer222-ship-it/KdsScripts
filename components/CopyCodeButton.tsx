"use client";

import { useState } from "react";

type Props = {
  slug: string;
  code?: string;
  label?: string;
  className?: string;
  variant?: "primary" | "ghost" | "dark";
  countCopy?: boolean;
};

export async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* segue para o fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyCodeButton({
  slug,
  code,
  label = "Copiar código",
  className = "",
  variant = "primary",
  countCopy = true,
}: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleCopy() {
    setState("loading");
    let texto = code;
    if (!texto) {
      try {
        const res = await fetch(`/api/scripts/${encodeURIComponent(slug)}`);
        const json = await res.json();
        texto = json?.script?.code;
      } catch {
        /* ignora */
      }
    }
    if (!texto) {
      setState("error");
      setTimeout(() => setState("idle"), 2200);
      return;
    }
    const ok = await copyText(texto);
    setState(ok ? "done" : "error");
    if (ok && countCopy) {
      fetch(`/api/scripts/${encodeURIComponent(slug)}/copy`, { method: "POST" }).catch(() => {});
    }
    setTimeout(() => setState("idle"), 2200);
  }

  const text =
    state === "done"
      ? "Copiado! Cole no executor"
      : state === "error"
        ? "Falhou — abra o script"
        : state === "loading"
          ? "Carregando..."
          : label;

  return (
    <button
      onClick={handleCopy}
      data-variant={variant}
      className={`btn ${
        variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn-dark"
      } ${className}`}
    >
      {state === "done" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m5 13 4 4L19 7" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15" />
        </svg>
      )}
      <span>{text}</span>
    </button>
  );
}
