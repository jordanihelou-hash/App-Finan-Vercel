import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { StoreProvider, useStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <StoreProvider>
      <AuthGuard />
    </StoreProvider>
  );
}

/**
 * AuthGuard sits inside StoreProvider so it can read authState.
 * - 'loading'          → spinner overlay (waiting for Firebase Auth)
 * - 'unauthenticated'  → redirect to /login
 * - 'authenticated'    → render app shell + outlet
 */
function AuthGuard() {
  const { state } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.authState === "unauthenticated") {
      navigate({ to: "/login" });
    }
  }, [state.authState, navigate]);

  if (state.authState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  if (state.authState === "unauthenticated") {
    // Redirect is in-flight; render nothing to avoid flash
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-md mx-auto px-4 pt-5 pb-28 flex flex-col gap-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
