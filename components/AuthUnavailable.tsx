"use client";

type AuthUnavailableProps = {
  onRetry: () => void | Promise<void>;
  loading?: boolean;
};

export default function AuthUnavailable({ onRetry, loading = false }: AuthUnavailableProps) {
  return (
    <div className="mx-auto max-w-[620px] pt-10">
      <div className="card p-6 text-center">
        <h1 className="text-[20px] font-extrabold text-white">Não foi possível validar sua sessão</h1>
        <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-relaxed text-slate-400">
          Sua conta não foi desconectada. O serviço de autenticação está temporariamente
          indisponível; tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={loading}
          className="btn btn-primary mt-5"
        >
          {loading ? "Verificando..." : "Tentar novamente"}
        </button>
      </div>
    </div>
  );
}
