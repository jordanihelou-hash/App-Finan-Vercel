import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { StoreProvider, useStore } from "@/lib/store";
import { Loader2, Plus } from "lucide-react";
import { AddTransactionModal } from "./_app.transactions";
import { UserProfileModal, isProfileComplete } from "@/components/UserProfileModal";

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
  const { state, addTransaction } = useStore();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (state.authState === "unauthenticated") {
      navigate({ to: "/login" });
    }
  }, [state.authState, navigate]);

  // Exibe modal de perfil apenas se o usuário não tem nome cadastrado
  // (primeiro acesso real). Usa state.members como fonte de verdade;
  // o localStorage só serve para evitar o flash antes dos membros carregarem.
  useEffect(() => {
    if (
      state.authState === "authenticated" &&
      state.currentUserId &&
      state.members.length > 0
    ) {
      const member = state.members.find((m) => m.id === state.currentUserId);
      const hasName = member?.name?.trim();
      if (!hasName && !isProfileComplete(state.currentUserId)) {
        setShowProfile(true);
      }
    }
  }, [state.authState, state.currentUserId, state.members]);

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

      {/* FAB global de novo lançamento — centralizado acima da bottom nav */}
      <button
        onClick={() => setShowAdd(true)}
        aria-label="Novo lançamento"
        className="fixed bottom-[4.5rem] left-1/2 -translate-x-1/2 z-40 size-14 grid place-items-center bg-primary text-primary-foreground rounded-2xl shadow-[0_8px_28px_-4px_oklch(0.68_0.22_305/0.6)] active:scale-95 transition-transform glow-violet"
      >
        <Plus className="size-6" />
      </button>

      <BottomNav />

      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          onSave={addTransaction}
        />
      )}

      {showProfile && state.currentUserId && (
        <UserProfileModal
          userId={state.currentUserId}
          currentName={state.members.find((m) => m.id === state.currentUserId)?.name ?? ""}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
