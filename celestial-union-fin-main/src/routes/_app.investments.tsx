import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore, formatBRL } from "@/lib/store";
import { TrendingUp, Plus, Minus } from "lucide-react";
import type { Investment } from "@/lib/mock-data";
import { Sheet } from "./_app.transactions";

export const Route = createFileRoute("/_app/investments")({
  component: InvestmentsPage,
});

const TYPES: Investment["type"][] = ["Renda Fixa", "Ações", "Fundos", "Criptomoedas"];
const typeColor: Record<Investment["type"], string> = {
  "Renda Fixa": "text-cyan bg-cyan/10",
  Ações: "text-emerald bg-emerald/10",
  Fundos: "text-amber bg-amber/10",
  Criptomoedas: "text-primary bg-primary/10",
};

function InvestmentsPage() {
  const { state } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");
  const [filter, setFilter] = useState<Investment["type"] | "Todos">("Todos");
  const [activeMove, setActiveMove] = useState<{ inv: Investment; kind: "aporte" | "resgate" } | null>(null);

  const total = state.investments.reduce((s, i) => s + i.applied, 0);
  const filtered = filter === "Todos" ? state.investments : state.investments.filter((i) => i.type === filter);
  const avgYield = state.investments.reduce((s, i) => s + i.projectedYield, 0) / state.investments.length;

  return (
    <>
      <AppHeader view={view} onViewChange={setView} />

      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Patrimônio Investido</p>
        <p className="mono text-3xl font-semibold mt-1">{formatBRL(total)}</p>
        <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
          {TYPES.map((t) => {
            const v = state.investments.filter((i) => i.type === t).reduce((s, i) => s + i.applied, 0);
            const pct = (v / Math.max(1, total)) * 100;
            return <div key={t} className={typeColor[t].split(" ")[1]} style={{ width: `${pct}%` }} />;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          {TYPES.map((t) => {
            const v = state.investments.filter((i) => i.type === t).reduce((s, i) => s + i.applied, 0);
            const pct = ((v / Math.max(1, total)) * 100).toFixed(0);
            return (
              <span key={t} className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${typeColor[t].split(" ")[1]}`} /> {t} {pct}%
              </span>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativos</p>
            <p className="mono text-lg font-medium mt-0.5">{state.investments.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rend. proj.</p>
            <p className="mono text-lg font-medium mt-0.5 text-emerald">{avgYield.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["Todos", ...TYPES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ring-1 transition-all ${
              filter === t ? "bg-primary/20 text-primary ring-primary/40" : "text-muted-foreground ring-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((inv, i) => (
          <div
            key={inv.id}
            className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${typeColor[inv.type]}`}>
                  <TrendingUp className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inv.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {inv.type}{inv.ticker && <> · <span className="mono">{inv.ticker}</span></>}
                  </p>
                </div>
              </div>
              <span className="text-emerald text-xs mono font-medium shrink-0 ml-2">+{inv.projectedYield}%</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aplicado</p>
                <p className="mono text-base font-medium mt-0.5">{formatBRL(inv.applied)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Movim.</p>
                <p className="mono text-base font-medium mt-0.5">{inv.moves.length}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setActiveMove({ inv, kind: "aporte" })}
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-emerald/15 text-emerald ring-1 ring-emerald/30 flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <Plus className="size-3.5" /> Aporte
              </button>
              <button
                onClick={() => setActiveMove({ inv, kind: "resgate" })}
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-coral/15 text-coral ring-1 ring-coral/30 flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <Minus className="size-3.5" /> Resgate
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeMove && <MoveModal data={activeMove} onClose={() => setActiveMove(null)} />}
    </>
  );
}

function MoveModal({ data, onClose }: { data: { inv: Investment; kind: "aporte" | "resgate" }; onClose: () => void }) {
  const { addInvestmentMove } = useStore();
  const [amount, setAmount] = useState("");

  return (
    <Sheet onClose={onClose} title={`${data.kind === "aporte" ? "Aporte" : "Resgate"} — ${data.inv.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseFloat(amount.replace(",", "."));
          if (!v || v <= 0) return;
          addInvestmentMove(data.inv.id, { kind: data.kind, amount: v });
          onClose();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Valor</span>
          <input
            autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
            className="w-full bg-white/5 ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm mono focus:ring-primary/50 outline-none"
          />
        </label>
        <button
          type="submit"
          className={`w-full py-3 font-semibold text-sm rounded-xl ${data.kind === "aporte" ? "bg-emerald text-background" : "bg-coral text-background"}`}
        >
          Confirmar {data.kind === "aporte" ? "aporte" : "resgate"}
        </button>
      </form>
    </Sheet>
  );
}
