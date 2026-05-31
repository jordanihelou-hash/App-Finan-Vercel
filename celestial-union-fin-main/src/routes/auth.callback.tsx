/**
 * /auth/callback — processa o retorno do OAuth do Google.
 *
 * Com PKCE (padrão do Supabase v2), o Google redireciona para:
 *   https://[project].supabase.co/auth/v1/callback?code=...
 * O Supabase então redireciona para o `redirectTo` configurado no signInWithOAuth,
 * que agora aponta para esta rota (/auth/callback) em vez da raiz (/).
 *
 * Supabase SDK com `detectSessionInUrl: true` troca o `?code=` por tokens
 * assim que o cliente é instanciado — essa rota apenas aguarda o evento
 * SIGNED_IN e redireciona para o app. Isso evita o race condition onde
 * o `/_app` recebia um INITIAL_SESSION null antes da troca do código,
 * causando o bounce de volta ao /login.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Aguarda a troca do código OAuth. O Supabase SDK processa o ?code=
    // automaticamente; só precisamos esperar o evento de sessão.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          navigate({ to: "/" });
        } else if (event === "INITIAL_SESSION" && session) {
          // Sessão já estava ativa (ex: refresh da página nesta rota)
          subscription.unsubscribe();
          navigate({ to: "/" });
        } else if (event === "INITIAL_SESSION" && !session) {
          // Sem sessão e sem code na URL — redireciona para login
          const hasCode = typeof window !== "undefined" &&
            (window.location.search.includes("code=") ||
             window.location.hash.includes("access_token="));
          if (!hasCode) {
            subscription.unsubscribe();
            navigate({ to: "/login" });
          }
          // Se há code= na URL, fica aguardando o SIGNED_IN que virá em seguida
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="size-14 rounded-2xl bg-primary/10 grid place-items-center">
          <Sparkles className="size-6 text-primary/60 animate-pulse" />
        </div>
        <Loader2 className="size-6 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Autenticando…</p>
      </div>
    </div>
  );
}
