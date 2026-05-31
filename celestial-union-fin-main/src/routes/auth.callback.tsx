/**
 * /auth/callback — processa o retorno do OAuth do Google.
 *
 * O Supabase redireciona aqui com #access_token= (implicit) após autenticação.
 * Usamos window.location.replace para fazer o redirect hard ao dashboard,
 * evitando problemas com a navegação client-side do TanStack Router nesse contexto.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  useEffect(() => {
    let cancelled = false;

    async function redirect() {
      // Tenta pegar a sessão que o SDK já processou do hash
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        window.location.replace("/");
        return;
      }

      // Fallback: aguarda SIGNED_IN (PKCE assíncrono) por até 10s
      const timeout = setTimeout(() => {
        if (!cancelled) window.location.replace("/login");
      }, 10_000);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, s) => {
          if (cancelled) return;
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s) {
            clearTimeout(timeout);
            subscription.unsubscribe();
            window.location.replace("/");
          }
        }
      );

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    redirect();

    return () => { cancelled = true; };
  }, []);

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
