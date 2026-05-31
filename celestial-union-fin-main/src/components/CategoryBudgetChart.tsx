/**
 * CategoryBudgetChart
 *
 * Gráfico de barras horizontais empilhadas por categoria de despesa.
 * Mostra o percentual gasto (Pago + Previsto) em relação ao teto (budget).
 *
 * Regras de cor:
 *   – Soma Pago + Previsto <= teto  →  barras em verde/roxo (padrão do app)
 *   – Soma Pago + Previsto >  teto  →  barra vira vermelho + badge "Extrapolado +X%"
 *
 * Ao extrapolar, dispara o callback onOverBudget(categoryName) que o pai
 * pode usar para chamar o endpoint de IA.
 */

import { useEffect, useRef } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import type { Category, Transaction } from "@/lib/mock-data";
import { formatBRL } from "@/lib/store";

interface CategoryBudgetChartProps {
  categories: Category[];
  transactions: Transaction[];
  /** Chamado quando alguma categoria extrapola o teto. Recebe a lista de nomes. */
  onOverBudget?: (overCategories: string[]) => void;
}

interface BarData {
  category: Category;
  paid: number;
  forecast: number;
  total: number;
  budget: number;
  paidPct: number;
  forecastPct: number;
  isOver: boolean;
  overPct: number;
}

export function CategoryBudgetChart({
  categories,
  transactions,
  onOverBudget,
}: CategoryBudgetChartProps) {
  const overCalledRef = useRef<string>("");

  // Apenas categorias de despesa com teto definido
  const expenseCategories = categories.filter(
    (c) => c.type === "expense" && c.budget && c.budget > 0
  );

  const bars: BarData[] = expenseCategories.map((cat) => {
    const catTx = transactions.filter((t) => t.categoryId === cat.id && t.type === "expense");
    const paid = catTx.filter((t) => t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const forecast = catTx.filter((t) => t.status === "previsto").reduce((s, t) => s + t.amount, 0);
    const total = paid + forecast;
    const budget = cat.budget!;
    const isOver = total > budget;
    const overPct = isOver ? Math.round(((total - budget) / budget) * 100) : 0;
    // Percentuais com cap em 100% para renderização da barra visual
    const paidPct = Math.min(100, (paid / budget) * 100);
    const forecastPct = Math.min(100 - paidPct, (forecast / budget) * 100);
    return { category: cat, paid, forecast, total, budget, paidPct, forecastPct, isOver, overPct };
  });

  // Dispara callback quando alguma categoria extrapola
  useEffect(() => {
    const overNames = bars.filter((b) => b.isOver).map((b) => b.category.name);
    const key = overNames.sort().join(",");
    if (key !== overCalledRef.current && overNames.length > 0) {
      overCalledRef.current = key;
      onOverBudget?.(overNames);
    }
  });

  if (bars.length === 0) return null;

  return (
    <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Orçamento por Categoria
        </h3>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <LegendDot color="bg-primary/70" label="Pago" />
        <LegendDot color="bg-amber/60" label="Previsto" />
        <LegendDot color="bg-coral" label="Extrapolado" />
      </div>

      <div className="flex flex-col gap-4">
        {bars.map((b) => (
          <BarRow key={b.category.id} data={b} />
        ))}
      </div>
    </div>
  );
}

function BarRow({ data: b }: { data: BarData }) {
  const barPaidColor = b.isOver ? "bg-coral" : "bg-primary/70";
  const barForecastColor = b.isOver ? "bg-coral/50" : "bg-amber/60";
  const totalPct = Math.min(100, (b.total / b.budget) * 100);

  return (
    <div>
      {/* Cabeçalho da linha */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`size-1.5 shrink-0 rounded-full ${dotColor(b.category.color)}`}
          />
          <span className="text-xs font-medium truncate">{b.category.name}</span>
          {b.isOver && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-coral/20 text-coral ring-1 ring-coral/30 shrink-0">
              <AlertTriangle className="size-2.5" />
              Extrapolado +{b.overPct}%
            </span>
          )}
        </div>
        <div className="text-right shrink-0 ml-2">
          <span className={`mono text-[11px] font-semibold ${b.isOver ? "text-coral" : "text-foreground"}`}>
            {formatBRL(b.total)}
          </span>
          <span className="text-[10px] text-muted-foreground"> / {formatBRL(b.budget)}</span>
        </div>
      </div>

      {/* Barra */}
      <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden">
        {/* Segmento Pago */}
        <div
          className={`absolute left-0 top-0 h-full rounded-l-full transition-all duration-500 ${barPaidColor}`}
          style={{ width: `${b.paidPct}%` }}
        />
        {/* Segmento Previsto */}
        <div
          className={`absolute top-0 h-full transition-all duration-500 ${barForecastColor}`}
          style={{ left: `${b.paidPct}%`, width: `${b.forecastPct}%` }}
        />
        {/* Indicador de overflow (margem vermelha) */}
        {b.isOver && (
          <div
            className="absolute right-0 top-0 h-full bg-coral/30 rounded-r-full"
            style={{ width: `${Math.min(100, ((b.total - b.budget) / b.budget) * 100)}%` }}
          />
        )}
      </div>

      {/* Sub-rótulos */}
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>
          <span className="text-primary/80">{formatBRL(b.paid)} pago</span>
          {b.forecast > 0 && (
            <span className="text-amber/80"> + {formatBRL(b.forecast)} prev.</span>
          )}
        </span>
        <span className={`mono font-medium ${b.isOver ? "text-coral" : totalPct >= 80 ? "text-amber" : "text-muted-foreground"}`}>
          {totalPct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className={`size-2 rounded-sm ${color}`} />
      {label}
    </div>
  );
}

function dotColor(c: string) {
  return c === "emerald"
    ? "bg-emerald"
    : c === "coral"
    ? "bg-coral"
    : c === "amber"
    ? "bg-amber"
    : c === "cyan"
    ? "bg-cyan"
    : "bg-primary";
}
