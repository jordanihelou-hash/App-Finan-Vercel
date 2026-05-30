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

// Estilo de input/select com fundo explícito
const inputCls = "w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50 transition-all text-foreground";

const TYPES: Investment["type"][] = ["Renda Fixa", "Ações", "Fundos", "Criptomoedas"];
const typeColor: Record<Investment["type"], string> = {
  "Renda Fixa": "text-cyan bg-cyan/10",
  Ações: "text-emerald bg-emerald/10",
  Fundos: "text-amber bg-amber/10",
  Criptomoedas: "text-primary bg-primary/10",
};

function InvestmentsPage() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Investment["type"] | "Todos">("Todos");
  const [activeMove, setActiveMove] = useState<{ inv: Investment; kind: "aporte" | "resgate" } | null>(null);
  const [showAddInv, setShowAddInv] = useState(false);

  const total = state.investments.reduce((s, i) => s + i.applied, 0);
  const filtered = filter === "Todos" ? state.investments : state.investments.filter((i) => i.type === filter);
  // Fix: evitar NaN quando não há investimentos
  const avgYield = state.investments.length > 0
    ? state.investments.reduce((s, i) => s + i.projectedYield, 0) / state.investments.length
    : 0;

  return (
    <>
      <AppHeader
        view="unified"
        onViewChange={() => {}}
        hideToggle
        rightSlot={
          <button
            onClick={() => setShowAddInv(true)}
            aria-label="Novo investimento"
            className="size-10 grid place-items-center bg-primary text-primary-foreground rounded-xl ring-1 ring-primary shadow-[0_4px_14px_-2px_oklch(0.68_0.22_305/0.45)] active:scale-95 transition"
          >
            <Plus className="size-4" />
          </button>
        }
      />

      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Patrimônio Investido</p>
        <p className="mono text-3xl font-semibold mt-1">{formatBRL(total)}</p>
        <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
          {TYPES.map((t) => {
            const v = state.investments.filter((i) => i.type === t).reduce((s, i) => s + i.applied, 0);
            const pct = total > 0 ? (v / total) * 100 : 0;
            return <div key={t} className={typeColor[t].split(" ")[1]} style={{ width: `${pct}%` }} />;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          {TYPES.map((t) => {
            const v = state.investments.filter((i) => i.type === t).reduce((s, i) => s + i.applied, 0);
            const pct = total > 0 ? ((v / total) * 100).toFixed(0) : "0";
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
            <p className="mono text-lg font-medium mt-0.5 text-emerald">
              {state.investments.length > 0 ? `${avgYield.toFixed(1)}%` : "—"}
            </p>
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

      {/* Empty state */}
      {state.investments.length === 0 && (
        <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-8 flex flex-col items-center gap-3 text-center animate-fade-up">
          <div className="size-14 rounded-2xl bg-emerald/10 grid place-items-center">
            <TrendingUp className="size-7 text-emerald" />
          </div>
          <p className="text-sm font-medium">Nenhum investimento cadastrado</p>
          <p className="text-xs text-muted-foreground">Registre seus ativos para acompanhar o patrimônio investido do casal.</p>
          <button
            onClick={() => setShowAddInv(true)}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl glow-violet"
          >
            + Adicionar primeiro investimento
          </button>
        </div>
      )}

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
      {showAddInv && <AddInvestmentModal onClose={() => setShowAddInv(false)} />}
    </>
  );
}

// ── Modal: Novo Investimento ──────────────────────────────────────────────────

function AddInvestmentModal({ onClose }: { onClose: () => void }) {
  const { addInvestment } = useStore();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<Investment["type"]>("Renda Fixa");
  const [applied, setApplied] = useState("");
  const [projectedYield, setProjectedYield] = useState("");

  return (
    <Sheet onClose={onClose} title="Novo Investimento">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const ap = parseFloat(applied.replace(",", ".")) || 0;
          const py = parseFloat(projectedYield.replace(",", ".")) || 0;
          addInvestment({
            name: name.trim(),
            ticker: ticker.trim() || undefined,
            type,
            applied: ap,
            projectedYield: py,
          });
          onClose();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Nome *</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tesouro IPCA+ 2035" required />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Tipo</span>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as Investment["type"])}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Ticker (opcional)</span>
          <input className={inputCls + " mono uppercase"} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="Ex: ITSA4, BTC" />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Valor aplicado (R$)</span>
          <input className={inputCls + " mono"} value={applied} onChange={(e) => setApplied(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Rendimento projetado (% a.a.)</span>
          <input className={inputCls + " mono"} value={projectedYield} onChange={(e) => setProjectedYield(e.target.value)} placeholder="Ex: 12.5" inputMode="decimal" />
        </label>

        <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet">
          Adicionar Investimento
        </button>
      </form>
    </Sheet>
  );
}

// ── Modal: Aporte / Resgate ───────────────────────────────────────────────────

function MoveModal({
  data,
  onClose,
}: {
  data: { inv: Investment; kind: "aporte" | "resgate" };
  onClose: () => void;
}) {
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
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Valor (R$)</span>
          <input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls + " mono"}
          />
        </label>
        <button
          type="submit"
          className={`w-full py-3 font-semibold text-sm rounded-xl ${
            data.kind === "aporte"
              ? "bg-emerald text-background"
              : "bg-coral text-background"
          }`}
        >
          Confirmar {data.kind === "aporte" ? "aporte" : "resgate"}
        </button>
      </form>
    </Sheet>
  );
}
