import { useMemo } from "react";
import { formatBRL } from "@/lib/store";

interface DayBucket {
  label: string;
  income: number;
  expense: number;
}

export function CashflowChart({ data }: { data: DayBucket[] }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => Math.max(d.income, d.expense))), [data]);

  return (
    <div className="flex-1 glass-card rounded-2xl ring-1 ring-white/5 ring-inset-soft relative overflow-hidden flex flex-col p-6 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium text-foreground">Fluxo de Caixa Consolidado</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Últimos 14 dias</p>
        </div>
        <div className="flex gap-4">
          <Legend color="emerald" label="Receitas" />
          <Legend color="coral" label="Despesas" />
        </div>
      </div>

      <div className="flex-1 min-h-[200px] w-full relative">
        <div className="absolute inset-0 flex items-end gap-1.5">
          {data.map((d, i) => {
            const ih = (d.income / max) * 100;
            const eh = (d.expense / max) * 100;
            return (
              <div key={i} className="flex-1 h-full flex flex-col justify-end gap-0.5 group relative">
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-panel ring-1 ring-white/10 text-[10px] mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                  <div className="text-emerald">+ {formatBRL(d.income)}</div>
                  <div className="text-coral">− {formatBRL(d.expense)}</div>
                </div>
                <div className="w-full bg-emerald/15 border-t-2 border-emerald rounded-t-sm transition-all hover:bg-emerald/25"
                  style={{ height: `${ih}%` }} />
                <div className="w-full bg-coral/15 border-t-2 border-coral rounded-t-sm transition-all hover:bg-coral/25"
                  style={{ height: `${eh}%` }} />
                <span className="text-[9px] text-muted-foreground text-center mono mt-1">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
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
