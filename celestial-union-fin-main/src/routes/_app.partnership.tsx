import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore } from "@/lib/store";
import { UserProfileModal } from "@/components/UserProfileModal";
import { Copy, Check, Link2, Shield, RefreshCw, LogOut, User, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/partnership")({
  component: PartnershipPage,
});

function PartnershipPage() {
  const { state, logout, regenerateCode, joinCouple } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");
  const [copied, setCopied] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    setJoinError(null);
    const ok = await joinCouple(joinCode.trim());
    if (ok) {
      setJoinSuccess(true);
      setJoinCode("");
    } else {
      setJoinError("Código inválido ou não encontrado. Verifique e tente novamente.");
    }
    setJoinLoading(false);
  };

  const copy = () => {
    navigator.clipboard?.writeText(state.coupleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentMember = state.members.find((m) => m.id === state.currentUserId);

  return (
    <>
      <AppHeader view={view} onViewChange={setView} />

      {/* Código de conexão */}
      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-6 animate-fade-up relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-56 bg-primary/20 blur-[70px] rounded-full pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="size-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary">Código de Conexão</span>
          </div>
          <h2 className="text-xl font-semibold mb-1">Convide seu parceiro</h2>
          <p className="text-xs text-muted-foreground mb-5">
            Compartilhe para unir orçamentos, contas e investimentos em tempo real.
          </p>

          <div className="mono text-2xl font-bold tracking-[0.18em] py-4 px-4 bg-background/60 ring-1 ring-primary/30 rounded-xl text-primary text-center glow-violet">
            {state.coupleCode}
          </div>
          <button
            onClick={copy}
            className="mt-3 w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            {copied ? <><Check className="size-4" /> Copiado</> : <><Copy className="size-4" /> Copiar código</>}
          </button>

          {state.partnerLinked ? (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald animate-ping opacity-60" />
                <span className="relative rounded-full size-1.5 bg-emerald" />
              </span>
              Parceiro vinculado — sincronizando em tempo real
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="relative flex size-1.5">
                <span className="relative rounded-full size-1.5 bg-amber" />
              </span>
              Aguardando parceiro — compartilhe o código acima
            </div>
          )}
        </div>
      </div>

      {/* Vincular a um parceiro existente (sem parceiro vinculado) */}
      {!state.partnerLinked && (
        <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-6 animate-fade-up">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="size-3.5 text-cyan" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-cyan">Entrar em um casal</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Já tem o código do seu parceiro? Insira abaixo para vincular as contas agora mesmo.
          </p>
          {joinSuccess ? (
            <div className="flex items-center gap-2 text-[12px] text-emerald p-3 bg-emerald/10 rounded-xl ring-1 ring-emerald/20">
              <Check className="size-4" /> Vinculado com sucesso! Seus dados estão sincronizados.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-background/60 ring-1 ring-white/10 rounded-xl px-4 py-3 focus-within:ring-primary/50 transition mb-3">
                <Sparkles className="size-4 text-muted-foreground shrink-0" />
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="JOIN-XXXX"
                  className="bg-transparent flex-1 outline-none text-sm mono tracking-widest uppercase"
                  maxLength={9}
                />
              </div>
              {joinError && (
                <p className="text-[11px] text-coral mb-2 p-2.5 bg-coral/10 ring-1 ring-coral/20 rounded-lg">{joinError}</p>
              )}
              <button
                onClick={handleJoin}
                disabled={joinLoading || !joinCode.trim()}
                className="w-full py-3 rounded-xl bg-cyan/20 text-cyan ring-1 ring-cyan/30 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-cyan/30 transition"
              >
                {joinLoading ? <><Loader2 className="size-3.5 animate-spin" /> Vinculando…</> : <><Link2 className="size-3.5" /> Vincular ao parceiro</>}
              </button>
            </>
          )}
        </div>
      )}

      {/* Privacidade */}
      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up">
        <Shield className="size-5 text-primary mb-3" />
        <h3 className="text-sm font-semibold mb-1.5">Privacidade compartilhada</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Apenas os dois membros vinculados acessam os dados. Tudo é criptografado e replicado instantaneamente entre os dispositivos.
        </p>
        <button
          onClick={regenerateCode}
          className="mt-4 text-xs text-primary font-medium flex items-center gap-1.5 active:opacity-70 transition-opacity"
        >
          <RefreshCw className="size-3" /> Regenerar código
        </button>
      </div>

      {/* Membros do casal */}
      <div className="flex flex-col gap-3">
        {state.members.map((m, i) => {
          const isCurrentUser = m.id === state.currentUserId;
          return (
            <div
              key={m.id}
              className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 flex items-center gap-3 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`size-12 rounded-2xl grid place-items-center text-base font-semibold text-white bg-gradient-to-br ${m.avatarColor} shrink-0`}>
                {m.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.name}
                  {isCurrentUser && <span className="ml-1.5 text-[10px] text-primary">(você)</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">{i === 0 ? "Administrador(a)" : "Co-administrador(a)"}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald">
                  <span className="size-1.5 rounded-full bg-emerald" /> Online · sincronizado
                </div>
              </div>
              {isCurrentUser && (
                <button
                  onClick={() => setShowProfile(true)}
                  className="text-[11px] text-primary hover:text-primary/80 shrink-0 flex items-center gap-1"
                >
                  <User className="size-3" /> Gerenciar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 animate-fade-up">
        {confirmLogout ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-center text-muted-foreground">Tem certeza que deseja sair?</p>
            <div className="flex gap-2">
              <button
                onClick={() => logout()}
                className="flex-1 py-2.5 bg-coral/20 text-coral ring-1 ring-coral/30 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <LogOut className="size-4" /> Sair
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2.5 bg-white/5 text-muted-foreground rounded-xl text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-coral transition-colors py-1"
          >
            <LogOut className="size-4" /> Sair da conta
          </button>
        )}
      </div>

      {/* Modal de perfil */}
      {showProfile && state.currentUserId && (
        <UserProfileModal
          userId={state.currentUserId}
          currentName={currentMember?.name ?? ""}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}
