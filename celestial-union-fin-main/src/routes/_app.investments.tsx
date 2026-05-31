import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore, formatBRL } from "@/lib/store";
import { TrendingUp, Plus, Minus, Trash2, Target, ChevronDown, ChevronRight } from "lucide-react";
import type { Investment, InvestmentGoal } from "@/lib/mock-data";
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
  const { state, deleteInvestment } = useStore();
  const [filter, setFilter] = useState<Investment["type"] | "Todos">("Todos");
  const [activeMove, setActiveMove] = useState<{ inv: Investment; kind: "aporte" | "resgate" } | null>(null);
  const [showAddInv, setShowAddInv] = useState(false);
  const [confirmDeleteInv, setConfirmDeleteInv] = useState<Investment | null>(null);
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());

  const toggleGoal = (goalId: string) => {
    setCollapsedGoals((prev) => {
      const next = new Set(prev);
      next.has(goalId) ? next.delete(goalId) : next.add(goalId);
      return next;
    });
  };

  const total = state.investments.reduce((s, i) => s + i.applied, 0);
  const filtered = filter === "Todos" ? state.investments : state.investments.filter((i) => i.type === filter);
  const avgYield = state.investments.length > 0
    ? state.investments.reduce((s, i) => s + i.projectedYield, 0) / state.investments.length
    : 0;

  // Agrupa investimentos filtrados por meta
  const goalGroups = groupByGoal(filtered, state.investmentGoals);

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
          <p className="text-xs text-muted-foreground">Registre seus ativos vinculados a uma meta para acompanhar o patrimônio do casal.</p>
          <button
            onClick={() => setShowAddInv(true)}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl glow-violet"
          >
            + Adicionar primeiro investimento
          </button>
        </div>
      )}

      {/* Grupos por Meta */}
      <div className="flex flex-col gap-4">
        {goalGroups.map(({ goal, investments: invs }) => {
          const groupTotal = invs.reduce((s, i) => s + i.applied, 0);
          const progress = goal.targetAmount ? Math.min(100, (groupTotal / goal.targetAmount) * 100) : null;
          const isCollapsed = collapsedGoals.has(goal.id);

          return (
            <div key={goal.id} className="flex flex-col gap-2 animate-fade-up">
              {/* Cabeçalho do grupo de meta */}
              <button
                type="button"
                onClick={() => toggleGoal(goal.id)}
                className="flex items-center gap-2 py-1 text-left w-full"
              >
                <span className="text-base">{goal.emoji}</span>
                <span className="text-xs font-semibold text-foreground flex-1">{goal.name}</span>
                <span className="mono text-[11px] text-muted-foreground">{formatBRL(groupTotal)}</span>
                {isCollapsed ? <ChevronRight className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
              </button>

              {/* Barra de progresso da meta */}
              {progress !== null && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mono shrink-0">
                    {progress.toFixed(0)}% de {formatBRL(goal.targetAmount!)}
                  </span>
                </div>
              )}

              {/* Cards de investimento */}
              {!isCollapsed && invs.map((inv, i) => (
                <div
                  key={inv.id}
                  className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 animate-fade-up ml-2"
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
                    <button
                      onClick={() => setConfirmDeleteInv(inv)}
                      aria-label="Excluir investimento"
                      className="size-8 rounded-lg grid place-items-center bg-white/5 text-muted-foreground ring-1 ring-white/10 hover:bg-coral/15 hover:text-coral hover:ring-coral/30 active:scale-95 transition"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {activeMove && <MoveModal data={activeMove} onClose={() => setActiveMove(null)} />}
      {showAddInv && <AddInvestmentModal onClose={() => setShowAddInv(false)} />}

      {confirmDeleteInv && (
        <Sheet onClose={() => setConfirmDeleteInv(null)} title="Excluir investimento">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <span className="text-foreground font-medium">"{confirmDeleteInv.name}"</span>?
              <span className="block mt-1 text-[11px] text-amber">
                ⚠ Todos os movimentos (aportes e resgates) também serão excluídos.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteInv(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 ring-1 ring-white/10 text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await deleteInvestment(confirmDeleteInv.id);
                  setConfirmDeleteInv(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-coral/20 text-coral ring-1 ring-coral/30"
              >
                Excluir
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ── Helper: agrupar investimentos por meta ────────────────────────────────────

const NO_GOAL_ID = "__sem_meta__";
const NO_GOAL: InvestmentGoal = { id: NO_GOAL_ID, name: "Sem Meta Definida", emoji: "📌" };

function groupByGoal(
  investments: Investment[],
  goals: InvestmentGoal[]
): { goal: InvestmentGoal; investments: Investment[] }[] {
  const map = new Map<string, { goal: InvestmentGoal; investments: Investment[] }>();

  investments.forEach((inv) => {
    const gid = inv.goalId ?? NO_GOAL_ID;
    if (!map.has(gid)) {
      const goal = goals.find((g) => g.id === gid) ?? NO_GOAL;
      map.set(gid, { goal, investments: [] });
    }
    map.get(gid)!.investments.push(inv);
  });

  return Array.from(map.values());
}

// ── Modal: Novo Investimento ──────────────────────────────────────────────────

function AddInvestmentModal({ onClose }: { onClose: () => void }) {
  const { addInvestment, addInvestmentGoal, state } = useStore();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<Investment["type"]>("Renda Fixa");
  const [applied, setApplied] = useState("");
  const [projectedYield, setProjectedYield] = useState("");
  const [goalId, setGoalId] = useState(state.investmentGoals[0]?.id ?? "");
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalEmoji, setNewGoalEmoji] = useState("🎯");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [saving, setSaving] = useState(false);

  function handleGoalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "__new__") {
      setShowNewGoal(true);
    } else {
      setGoalId(e.target.value);
      setShowNewGoal(false);
    }
  }

  function createNewGoal() {
    if (!newGoalName.trim()) return;
    const target = parseFloat(newGoalTarget.replace(",", ".")) || undefined;
    const id = addInvestmentGoal({ name: newGoalName.trim(), emoji: newGoalEmoji, targetAmount: target });
    setGoalId(id);
    setShowNewGoal(false);
  }

  return (
    <Sheet onClose={onClose} title="Novo Investimento">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || saving) return;
          setSaving(true);
          const ap = parseFloat(applied.replace(",", ".")) || 0;
          const py = parseFloat(projectedYield.replace(",", ".")) || 0;
          await addInvestment({
            name: name.trim(),
            ticker: ticker.trim() || undefined,
            type,
            applied: ap,
            projectedYield: py,
            goalId: goalId || undefined,
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

        {/* Meta vinculada */}
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block flex items-center gap-1">
            <Target className="size-3" /> Meta *
          </span>
          {showNewGoal ? (
            <div className="space-y-2 p-3 bg-white/5 rounded-lg ring-1 ring-primary/20">
              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Nova Meta</p>
              <div className="flex gap-2">
                <input
                  className={inputCls + " w-12 text-center text-lg"}
                  value={newGoalEmoji}
                  onChange={(e) => setNewGoalEmoji(e.target.value)}
                  placeholder="🎯"
                  maxLength={2}
                />
                <input
                  className={inputCls + " flex-1"}
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="Nome da meta"
                  autoFocus
                />
              </div>
              <input
                className={inputCls + " mono"}
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                placeholder="Valor-alvo R$ (opcional)"
                inputMode="decimal"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createNewGoal}
                  className="flex-1 py-2 bg-primary/20 text-primary rounded-lg text-xs font-medium"
                >
                  Criar Meta
                </button>
                <button type="button" onClick={() => setShowNewGoal(false)} className="flex-1 py-2 bg-white/5 text-muted-foreground rounded-lg text-xs">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <select className={inputCls} value={goalId} onChange={handleGoalChange}>
              {state.investmentGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
              ))}
              <option value="__new__">+ Criar nova meta…</option>
            </select>
          )}
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

        <button
          type="submit"
          disabled={saving || !name.trim() || showNewGoal}
          className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {saving ? "Salvando…" : "Adicionar Investimento"}
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

  const numericValue = parseFloat(amount.replace(",", ".")) || 0;
  const isResgate = data.kind === "resgate";
  // Validação: resgate não pode ultrapassar o valor aplicado
  const exceedsApplied = isResgate && numericValue > data.inv.applied;
  const isInvalid = !numericValue || numericValue <= 0 || exceedsApplied;

  return (
    <Sheet onClose={onClose} title={`${isResgate ? "Resgate" : "Aporte"} — ${data.inv.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isInvalid) return;
          addInvestmentMove(data.inv.id, { kind: data.kind, amount: numericValue });
          onClose();
        }}
        className="space-y-4"
      >
        {isResgate && (
          <div className="p-3 bg-white/5 rounded-lg text-[11px] text-muted-foreground">
            Disponível para resgate: <span className="mono text-foreground font-medium">{formatBRL(data.inv.applied)}</span>
          </div>
        )}
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Valor (R$)</span>
          <input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls + " mono" + (exceedsApplied ? " ring-coral/60" : "")}
          />
        </label>
        {exceedsApplied && (
          <p className="text-[11px] text-coral p-2.5 bg-coral/10 ring-1 ring-coral/20 rounded-lg">
            Valor supera o saldo aplicado ({formatBRL(data.inv.applied)}). Reduza o valor para continuar.
          </p>
        )}
        <button
          type="submit"
          disabled={isInvalid}
          className={`w-full py-3 font-semibold text-sm rounded-xl disabled:opacity-50 ${
            isResgate ? "bg-coral text-background" : "bg-emerald text-background"
          }`}
        >
          Confirmar {isResgate ? "resgate" : "aporte"}
        </button>
      </form>
    </Sheet>
  );
}
