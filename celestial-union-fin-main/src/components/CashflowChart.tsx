import { useMemo, useState } from "react";
import { formatBRL } from "@/lib/store";
import { TrendingUp, BarChart2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayBucket {
  label: string;
  income: number;
  expense: number;
  /** Date object for month-filtering (passed from parent) */
  date?: Date;
}

interface MonthBucket {
  label: string; // "Jan", "Fev", etc.
  income: number;
  expense: number;
  balance: number; // cumulative / running balance
}

interface Props {
  data: DayBucket[];
  /** All transactions (unfiltered) for the progression chart */
  allTransactions?: Array<{
    date: string;
    type: "income" | "expense";
    amount: number;
  }>;
  /** Starting balance (sum of all accounts) for progression */
  totalBalance?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildMonthBuckets(
  allTransactions: Props["allTransactions"] = [],
  totalBalance: number = 0
): MonthBucket[] {
  const now = new Date();
  // Build last 6 months (inclusive of current)
  const buckets: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: PT_MONTHS[d.getMonth()],
      income: 0,
      expense: 0,
      balance: 0,
    });
  }

  // Distribute transactions into buckets
  allTransactions?.forEach((t) => {
    const td = new Date(t.date);
    const idx = buckets.findIndex((_, i) => {
      const bd = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return td.getFullYear() === bd.getFullYear() && td.getMonth() === bd.getMonth();
    });
    if (idx >= 0) {
      if (t.type === "income") buckets[idx].income += t.amount;
      else buckets[idx].expense += t.amount;
    }
  });

  // Compute running balance (work backwards from current totalBalance)
  // We know current balance = totalBalance. Walk backwards to compute prior balances.
  let running = totalBalance;
  for (let i = buckets.length - 1; i >= 0; i--) {
    buckets[i].balance = running;
    running = running - buckets[i].income + buckets[i].expense;
  }

  return buckets;
}

// ── Current Month Chart ───────────────────────────────────────────────────────

function CurrentMonthChart({ data }: { data: DayBucket[] }) {
  const now = new Date();
  const monthName = PT_MONTHS[now.getMonth()];
  const year = now.getFullYear();

  // Filter to current month only
  const monthData = useMemo(() => {
    return data.filter((d) => {
      if (!d.date) return true; // passthrough if no date
      return d.date.getMonth() === now.getMonth() && d.date.getFullYear() === now.getFullYear();
    });
  }, [data]);

  const totalIncome = useMemo(() => monthData.reduce((s, d) => s + d.income, 0), [monthData]);
  const totalExpense = useMemo(() => monthData.reduce((s, d) => s + d.expense, 0), [monthData]);
  const balance = totalIncome - totalExpense;
  const max = useMemo(() => Math.max(1, ...monthData.map((d) => Math.max(d.income, d.expense))), [monthData]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald/10 ring-1 ring-emerald/20 rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-wider text-emerald font-bold mb-1">Entradas</p>
          <p className="mono text-sm font-semibold text-emerald leading-tight">{formatBRL(totalIncome)}</p>
        </div>
        <div className="bg-coral/10 ring-1 ring-coral/20 rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-wider text-coral font-bold mb-1">Saídas</p>
          <p className="mono text-sm font-semibold text-coral leading-tight">{formatBRL(totalExpense)}</p>
        </div>
        <div className={`${balance >= 0 ? "bg-primary/10 ring-1 ring-primary/20" : "bg-coral/10 ring-1 ring-coral/20"} rounded-xl p-3`}>
          <p className={`text-[9px] uppercase tracking-wider font-bold mb-1 ${balance >= 0 ? "text-primary" : "text-coral"}`}>Saldo</p>
          <p className={`mono text-sm font-semibold leading-tight ${balance >= 0 ? "text-primary" : "text-coral"}`}>{formatBRL(balance)}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="min-h-[160px] w-full relative">
        <div className="absolute inset-0 flex items-end gap-1">
          {monthData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma transação neste mês
            </div>
          ) : (
            monthData.map((d, i) => {
              const ih = (d.income / max) * 100;
              const eh = (d.expense / max) * 100;
              const hasData = d.income > 0 || d.expense > 0;
              return (
                <div key={i} className="flex-1 h-full flex flex-col justify-end gap-0.5 group relative">
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-panel ring-1 ring-white/10 text-[10px] mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                    <div className="text-emerald">+ {formatBRL(d.income)}</div>
                    <div className="text-coral">− {formatBRL(d.expense)}</div>
                  </div>
                  <div
                    className={`w-full rounded-t-sm transition-all ${ih > 0 ? "bg-emerald/20 border-t-2 border-emerald hover:bg-emerald/35" : "bg-white/5"}`}
                    style={{ height: `${Math.max(ih > 0 ? 3 : 1, ih)}%` }}
                  />
                  <div
                    className={`w-full rounded-t-sm transition-all ${eh > 0 ? "bg-coral/20 border-t-2 border-coral hover:bg-coral/35" : "bg-white/5"}`}
                    style={{ height: `${Math.max(eh > 0 ? 3 : 1, eh)}%` }}
                  />
                  <span className={`text-[8px] text-center mono mt-1 ${hasData ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{d.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-4 justify-end">
        <Legend color="emerald" label="Receitas" />
        <Legend color="coral" label="Despesas" />
      </div>

      <p className="text-[10px] text-muted-foreground text-center -mt-2">
        {monthName} {year} · dia a dia
      </p>
    </div>
  );
}

// ── Progression Chart ─────────────────────────────────────────────────────────

function ProgressionChart({ buckets }: { buckets: MonthBucket[] }) {
  const maxBalance = Math.max(1, ...buckets.map((b) => b.balance));
  const minBalance = Math.min(0, ...buckets.map((b) => b.balance));
  const range = maxBalance - minBalance || 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Last month summary */}
      {buckets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald/10 ring-1 ring-emerald/20 rounded-xl p-3">
            <p className="text-[9px] uppercase tracking-wider text-emerald font-bold mb-1">Entradas (mês)</p>
            <p className="mono text-sm font-semibold text-emerald leading-tight">
              {formatBRL(buckets[buckets.length - 1].income)}
            </p>
          </div>
          <div className="bg-coral/10 ring-1 ring-coral/20 rounded-xl p-3">
            <p className="text-[9px] uppercase tracking-wider text-coral font-bold mb-1">Saídas (mês)</p>
            <p className="mono text-sm font-semibold text-coral leading-tight">
              {formatBRL(buckets[buckets.length - 1].expense)}
            </p>
          </div>
          <div className="bg-primary/10 ring-1 ring-primary/20 rounded-xl p-3">
            <p className="text-[9px] uppercase tracking-wider text-primary font-bold mb-1">Patrimônio</p>
            <p className="mono text-sm font-semibold text-primary leading-tight">
              {formatBRL(buckets[buckets.length - 1].balance)}
            </p>
          </div>
        </div>
      )}

      {/* Line/bar progression */}
      <div className="min-h-[160px] w-full relative">
        <div className="absolute inset-0 flex items-end gap-2">
          {buckets.map((b, i) => {
            const h = ((b.balance - minBalance) / range) * 100;
            const isPositive = b.balance >= 0;
            return (
              <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-panel ring-1 ring-white/10 text-[10px] mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                  <div className={isPositive ? "text-primary" : "text-coral"}>{formatBRL(b.balance)}</div>
                  <div className="text-emerald text-[9px]">↑ {formatBRL(b.income)}</div>
                  <div className="text-coral text-[9px]">↓ {formatBRL(b.expense)}</div>
                </div>
                <div
                  className={`w-full rounded-t-md transition-all ${isPositive ? "bg-primary/30 border-t-2 border-primary hover:bg-primary/45" : "bg-coral/30 border-t-2 border-coral hover:bg-coral/45"}`}
                  style={{ height: `${Math.max(4, h)}%` }}
                />
                <span className="text-[9px] text-muted-foreground text-center mono mt-1">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Evolução do patrimônio · últimos 6 meses
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CashflowChart({ data, allTransactions = [], totalBalance = 0 }: Props) {
  const [chartView, setChartView] = useState<"month" | "progression">("month");

  const monthBuckets = useMemo(
    () => buildMonthBuckets(allTransactions, totalBalance),
    [allTransactions, totalBalance]
  );

  return (
    <div className="flex-1 glass-card rounded-2xl ring-1 ring-white/5 ring-inset-soft relative overflow-hidden flex flex-col p-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {chartView === "month" ? "Fluxo do Mês Atual" : "Progressão Financeira"}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {chartView === "month" ? "Entradas · Saídas · Saldo" : "Patrimônio por mês"}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => setChartView("month")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              chartView === "month"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="size-3" />
            Mês Atual
          </button>
          <button
            onClick={() => setChartView("progression")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              chartView === "progression"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="size-3" />
            Progressão
          </button>
        </div>
      </div>

      {/* Chart body */}
      {chartView === "month" ? (
        <CurrentMonthChart data={data} />
      ) : (
        <ProgressionChart buckets={monthBuckets} />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: "emerald" | "coral"; label: string }) {
  const cls = color === "emerald" ? "bg-emerald" : "bg-coral";
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <div className={`size-2 rounded-full ${cls}`} />
      {label}
    </div>
  );
}
