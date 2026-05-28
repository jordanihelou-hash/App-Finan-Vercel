import { formatBRL } from "@/lib/store";

interface Props {
  label: string;
  value: number;
  accent?: "default" | "emerald" | "coral" | "amber" | "cyan";
  trend?: string;
  trendTone?: "up" | "down" | "neutral";
}

const accentClass: Record<NonNullable<Props["accent"]>, string> = {
  default: "text-foreground",
  emerald: "text-emerald",
  coral: "text-coral",
  amber: "text-amber",
  cyan: "text-cyan",
};

export function KpiCard({ label, value, accent = "default", trend, trendTone = "neutral" }: Props) {
  const tone =
    trendTone === "up" ? "text-emerald" : trendTone === "down" ? "text-coral" : "text-muted-foreground";
  return (
    <div className="glass-card p-4 rounded-xl ring-1 ring-white/10 ring-inset-soft transition-all hover:ring-primary/20 hover:translate-y-[-1px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <div className={`mt-1 mono text-xl font-medium tracking-tight ${accentClass[accent]}`}>
        {formatBRL(value)}
      </div>
      {trend && <div className={`mt-2 text-[10px] ${tone}`}>{trend}</div>}
    </div>
  );
}
