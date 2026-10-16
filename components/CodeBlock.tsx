"use client";

import { useEffect, useMemo, useState } from "react";
import { copyText } from "./CopyCodeButton";

type Token = { text: string; cls: string };

const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while", "self",
  "continue", "goto",
]);

const BUILTINS = new Set([
  "game", "workspace", "script", "Instance", "Vector2", "Vector3", "CFrame", "Color3",
  "UDim2", "UDim", "Enum", "task", "wait", "spawn", "delay", "print", "warn", "error",
  "pcall", "xpcall", "ipairs", "pairs", "next", "type", "typeof", "tostring", "tonumber",
  "math", "string", "table", "os", "require", "loadstring", "getgenv", "getrawmetatable",
  "fireproximityprompt", "firetouchinterest", "Drawing", "Players", "RunService",
  "UserInputService", "VirtualInputManager", "HttpService", "TweenService", "StarterGui",
  "setclipboard", "identifyexecutor", "gethui", "syn", "Rayfield", "Fluxus",
]);

const TOKEN_RE =
  /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[[\s\S]*?\]\])|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\s\w]+)/g;

function tokenize(code: string): Token[][] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) tokens.push({ text: code.slice(last, m.index), cls: "t-plain" });
    last = m.index + m[0].length;

    if (m[1]) tokens.push({ text: m[0], cls: "t-comment" });
    else if (m[2]) tokens.push({ text: m[0], cls: "t-string" });
    else if (m[3]) tokens.push({ text: m[0], cls: "t-number" });
    else if (m[4]) {
      const word = m[0];
      const cls = KEYWORDS.has(word)
        ? "t-key"
        : BUILTINS.has(word)
          ? "t-builtin"
          : code[last] === "("
            ? "t-func"
            : "t-plain";
      tokens.push({ text: word, cls });
    } else tokens.push({ text: m[0], cls: "t-plain" });
  }
  if (last < code.length) tokens.push({ text: code.slice(last), cls: "t-plain" });

  // quebra em linhas
  const lines: Token[][] = [[]];
  for (const tk of tokens) {
    const parts = tk.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, cls: tk.cls });
    });
  }
  return lines;
}

const CLS: Record<string, string> = {
  "t-plain": "text-slate-300",
  "t-comment": "text-emerald-500/70 italic",
  "t-string": "text-amber-300",
  "t-number": "text-fuchsia-300",
  "t-key": "text-brand-400 font-semibold",
  "t-builtin": "text-sky-300",
  "t-func": "text-violet-300",
};

function CodeLines({ lines }: { lines: Token[][] }) {
  return (
    <pre className="code">
      <code>
        {lines.map((line, i) => (
          <div key={i} className="flex hover:bg-white/3">
            <span className="mr-4 inline-block w-9 shrink-0 select-none text-right text-[11px] text-slate-600">
              {i + 1}
            </span>
            <span className="flex-1">
              {line.length === 0 ? (
                <span>&nbsp;</span>
              ) : (
                line.map((tk, j) => (
                  <span key={j} className={CLS[tk.cls] ?? "text-slate-300"}>
                    {tk.text}
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}

export default function CodeBlock({
  code,
  slug,
  fileName = "script.lua",
  maxHeight = 520,
  onCopy,
}: {
  code: string;
  slug: string;
  fileName?: string;
  maxHeight?: number;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => tokenize(code), [code]);
  const sizeKb = (new Blob([code]).size / 1024).toFixed(1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    if (fullscreen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  async function handleCopy() {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      onCopy?.();
      fetch(`/api/scripts/${encodeURIComponent(slug)}/copy`, { method: "POST" }).catch(() => {});
      setTimeout(() => setCopied(false), 2400);
    }
  }

  function handleDownload() {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "script"}.lua`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#0b0e13] px-3 py-2">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </span>
      <span className="ml-2 font-mono text-[12.5px] text-slate-400">{fileName}</span>
      <span className="ml-2 hidden text-[11.5px] text-slate-600 sm:inline">
        {lines.length} linhas · {sizeKb} KB
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={handleCopy} className="btn btn-primary !px-3 !py-1.5 !text-[12.5px]">
          {copied ? "✅ Copiado!" : "📋 Copiar código"}
        </button>
        <button onClick={handleDownload} className="btn btn-dark !px-3 !py-1.5 !text-[12.5px]">
          ⬇ .lua
        </button>
        <button
          onClick={() => setFullscreen(true)}
          className="btn btn-dark !px-3 !py-1.5 !text-[12.5px]"
          title="Tela cheia"
        >
          ⛶
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="code-window">
        {toolbar}
        <div
          className="code-scroll"
          style={{ maxHeight: expanded ? "none" : `${maxHeight}px` }}
        >
          <CodeLines lines={lines} />
        </div>
        {!expanded && lines.length > 22 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full border-t border-white/8 bg-[#0b0e13] py-2.5 text-[12.5px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-brand-300"
          >
            ⌄ Mostrar o código completo ({lines.length} linhas)
          </button>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/92 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="mb-3 flex items-center gap-3">
            <h4 className="truncate font-mono text-[13px] text-slate-300">{fileName}</h4>
            <div className="ml-auto flex gap-2">
              <button onClick={handleCopy} className="btn btn-primary !py-1.5 !text-[12.5px]">
                {copied ? "✅ Copiado!" : "📋 Copiar"}
              </button>
              <button
                onClick={() => setFullscreen(false)}
                className="btn btn-dark !py-1.5 !text-[12.5px]"
              >
                ✕ Fechar (ESC)
              </button>
            </div>
          </div>
          <div className="code-window flex-1 overflow-hidden">
            <div className="code-scroll h-full" style={{ maxHeight: "100%" }}>
              <CodeLines lines={lines} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
