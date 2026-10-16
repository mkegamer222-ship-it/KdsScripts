"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/types";

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

const SESSION_CHECK_ERROR = "Não foi possível verificar sua sessão agora.";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!res.ok) {
        if (requestId.current === currentRequest) setError(SESSION_CHECK_ERROR);
        return;
      }

      const data = await res.json();
      if (data?.ok !== true) {
        if (requestId.current === currentRequest) setError(SESSION_CHECK_ERROR);
        return;
      }

      if (requestId.current === currentRequest) {
        // Apenas uma resposta válida pode encerrar uma sessão no cliente.
        // Erros de rede/servidor mantêm o último estado conhecido.
        setUser(data.user ?? null);
        setError(null);
      }
    } catch {
      if (requestId.current === currentRequest) setError(SESSION_CHECK_ERROR);
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
