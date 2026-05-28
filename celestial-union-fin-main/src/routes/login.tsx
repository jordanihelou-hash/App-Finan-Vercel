import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { signInWithGoogle, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Gestor Financeiro do Casal" },
      { name: "description", content: "Acesse o portal financeiro do seu casal." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "join">("login");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se já tem sessão ativa, redireciona direto para o dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  /**
   * Inicia o fluxo OAuth com Google (redirect, não popup).
   * No modo "join", salva o código no sessionStorage antes do redirect;
   * o StoreProvider vai lê-lo após o retorno do OAuth e vincular o casal.
   */
  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    try {
      if (mode === "join" && !code.trim()) {
        setError("Insira o código de conexão do seu parceiro.");
        setLoading(false);
        return;
      }

      await signInWithGoogle(mode === "join" ? code : undefined);
      // A partir daqui o browser redireciona para o Google.
      // O loading fica true enquanto o redirect acontece.
    } catch (err: unknown) {
      console.error("[LoginPage] signInWithGoogle error:", err);
      const msg =
        err instanceof Error ? err.message : "Erro ao iniciar login. Tente novamente.";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[20%] size-[600px] bg-primary/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] size-[500px] bg-cyan/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Brand panel — desktop only */}
      <aside className="hidden lg:flex flex-col justify-between flex-1 p-12 relative">
        <div className="flex items-center gap-2">
          <div className="size-9 bg-primary rounded-xl grid place-items-center glow-violet">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Cofre do Casal</span>
        </div>

        <div className="max-w-md">
          <p className="text-[11px] uppercase tracking-widest text-primary font-bold mb-3">
            Cosmic Slate
          </p>
          <h1 className="text-5xl font-semibold leading-tight text-balance">
            Finanças de casal,
            <br />
            <span className="text-primary">sincronizadas em tempo real.</span>
          </h1>
          <p className="text-muted-foreground mt-6 text-balance">
            Uma única visão para dois patrimônios. Análise de IA, orçamento
            conjunto e parceria financeira sem fricção.
          </p>
        </div>

        <div className="flex gap-6 text-xs text-muted-foreground">
          <div>
            <div className="mono text-2xl text-foreground">94%</div>
            <div>Sincronia média</div>
          </div>
          <div>
            <div className="mono text-2xl text-foreground">R$ 2,1M</div>
            <div>Patrimônio gerido</div>
          </div>
          <div>
            <div className="mono text-2xl text-foreground">31%</div>
            <div>Mais investido/ano</div>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="w-full lg:w-[480px] flex items-center justify-center p-8 relative">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="size-9 bg-primary rounded-xl grid place-items-center">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Cofre do Casal</span>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-8">
            <button
              onClick={() => {
                setMode("login");
                setError(null);
                setCode("");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                mode === "join"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Vincular ao parceiro
            </button>
          </div>

          <h2 className="text-2xl font-semibold mb-1">
            {mode === "login" ? "Bem-vindo de volta" : "Vincular ao casal"}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "login"
              ? "Acesse o painel com sua conta Google."
              : "Insira o código do seu parceiro e entre com Google."}
          </p>

          {/* Join code input */}
          {mode === "join" && (
            <label className="block mb-6">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
                Código de conexão
              </span>
              <div className="flex items-center gap-3 bg-white/5 ring-1 ring-white/10 rounded-xl px-4 py-3 focus-within:ring-primary/50 transition">
                <Sparkles className="size-4 text-muted-foreground shrink-0" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="JOIN-XXXX"
                  className="bg-transparent flex-1 outline-none text-sm mono tracking-widest uppercase"
                  maxLength={9}
                />
              </div>
            </label>
          )}

          {/* Error message */}
          {error && (
            <p className="text-xs text-coral mb-4 p-3 bg-coral/10 ring-1 ring-coral/20 rounded-lg">
              {error}
            </p>
          )}

          {/* Google sign-in button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading || (mode === "join" && !code.trim())}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Redirecionando…
              </>
            ) : (
              <>
                <GoogleIcon className="size-4" />
                {mode === "login" ? "Entrar com Google" : "Vincular com Google"}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground leading-relaxed">
            {mode === "login"
              ? "Ao entrar, uma parceria será criada automaticamente com o seu código de convite."
              : "Você será vinculado ao casal do seu parceiro após autenticação."}
          </p>
        </div>
      </main>
    </div>
  );
}

/** Minimal Google 'G' SVG icon */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
