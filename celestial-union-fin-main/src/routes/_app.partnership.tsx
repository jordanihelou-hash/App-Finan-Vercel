import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore } from "@/lib/store";
import { Copy, Check, Link2, Shield, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/partnership")({
  component: PartnershipPage,
});

function PartnershipPage() {
  const { state } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(state.coupleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <AppHeader view={view} onViewChange={setView} />

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

          <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald animate-ping opacity-60" />
              <span className="relative rounded-full size-1.5 bg-emerald" />
            </span>
            Parceiro vinculado — sincronizando em tempo real
          </div>
        </div>
      </div>

      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up">
        <Shield className="size-5 text-primary mb-3" />
        <h3 className="text-sm font-semibold mb-1.5">Privacidade compartilhada</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Apenas os dois membros vinculados acessam os dados. Tudo é criptografado e replicado instantaneamente entre os dispositivos.
        </p>
        <button className="mt-4 text-xs text-primary font-medium flex items-center gap-1.5">
          <RefreshCw className="size-3" /> Regenerar código
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {state.members.map((m, i) => (
          <div
            key={m.id}
            className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 flex items-center gap-3 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`size-12 rounded-2xl grid place-items-center text-base font-semibold text-white bg-gradient-to-br ${m.avatarColor} shrink-0`}>
              {m.initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-[11px] text-muted-foreground">{i === 0 ? "Administradora" : "Co-administrador"}</p>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald">
                <span className="size-1.5 rounded-full bg-emerald" /> Online · sincronizado
              </div>
            </div>
            <button className="text-[11px] text-muted-foreground hover:text-foreground shrink-0">Gerenciar</button>
          </div>
        ))}
      </div>
    </>
  );
}
