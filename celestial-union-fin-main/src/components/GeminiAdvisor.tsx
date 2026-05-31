import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useStore } from "@/lib/store";
import { Sparkles, Loader2, AlertTriangle, Lightbulb, Zap } from "lucide-react";

export interface Analysis {
  score: number;
  status: "Saudável" | "Atenção" | "Crítico";
  summary: string;
  critical: string[];
  suggestions: { title: string; detail: string }[];
  risks: string[];
  goldenTip: string;
}

// ── Local fallback generator (runs synchronously before first server call) ────

function localScore(income: number, expense: number, invested: number): Analysis {
  // Sem dados ainda: retorna estado neutro/inicial
  if (income === 0 && expense === 0 && invested === 0) {
    return {
      score: 0,
      status: "Atenção",
      summary: "Adicione seus lançamentos e contas para receber uma análise personalizada do casal.",
      critical: [],
      suggestions: [
        { title: "Comece pelo básico", detail: "Cadastre suas contas bancárias na aba Contas." },
        { title: "Registre receitas", detail: "Adicione seu salário e outras entradas na aba Lançar." },
      ],
      risks: ["Sem dados históricos não é possível detectar riscos."],
      goldenTip: "Casais que conversam sobre dinheiro com leveza investem 31% mais ao ano. Registre seus primeiros lançamentos e clique em 'Gerar Nova Análise'.",
    };
  }

  const ratio = income > 0 ? expense / income : 1;
  const savingsRate = Math.max(0, 1 - ratio);
  const investRatio = invested / Math.max(1, income * 12);
  let score = Math.round(40 + savingsRate * 45 + Math.min(15, investRatio * 30));
  score = Math.max(12, Math.min(96, score));
  const status: Analysis["status"] =
    score >= 75 ? "Saudável" : score >= 55 ? "Atenção" : "Crítico";
  return {
    score,
    status,
    summary:
      status === "Saudável"
        ? "Excelente sintonia. Continue protegendo o que construíram juntos."
        : status === "Atenção"
        ? "Parceria estável, mas alguns padrões de consumo merecem atenção."
        : "Atenção: despesas elevadas. Vale revisar prioridades essa semana.",
    critical:
      score < 75
        ? ["Despesas acima do recomendado.", "Reserva de emergência insuficiente."]
        : ["Monitore gastos variáveis mensalmente."],
    suggestions: [
      { title: "Aporte automático", detail: "Configure débito automático em renda fixa no dia 5." },
      { title: "Revisar assinaturas", detail: "Cancele serviços não utilizados este mês." },
    ],
    risks: [
      "Sazonalidade pode elevar despesas no próximo mês.",
      "Reserve 6 meses de despesas como fundo de emergência.",
    ],
    goldenTip:
      "Casais que conversam sobre dinheiro com leveza investem 31% mais ao ano. Clique em 'Gerar Nova Análise' para insights personalizados via IA.",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface GeminiAdvisorHandle {
  triggerOverBudget: (overCategories: string[]) => void;
}

export const GeminiAdvisor = forwardRef<
  GeminiAdvisorHandle,
  { income: number; expense: number; invested: number }
>(function GeminiAdvisorInner({ income, expense, invested }, ref) {
  const { state } = useStore();
  const [analysis, setAnalysis] = useState<Analysis>(() =>
    localScore(income, expense, invested)
  );
  const [loading, setLoading] = useState(false);
  const [overBudgetBanner, setOverBudgetBanner] = useState<string[] | null>(null);

  // Atualiza a análise local quando os dados carregam (ex: primeira vez com dados reais)
  useEffect(() => {
    setAnalysis((prev) => {
      if (prev.score === 0 && (income > 0 || expense > 0 || invested > 0)) {
        return localScore(income, expense, invested);
      }
      return prev;
    });
  }, [income, expense, invested]);

  const [apiError, setApiError] = useState<string | null>(null);

  const regenerate = async (overCats?: string[]) => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income,
          expense,
          invested,
          memberNames: state.members.map((m) => m.name),
          overBudgetCategories: overCats ?? [],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: Analysis = await res.json();
      setAnalysis(result);
    } catch (err) {
      console.error("[GeminiAdvisor] /api/analyze error:", err);
      setApiError("Não foi possível gerar análise. Verifique a chave Gemini.");
    }
    setLoading(false);
  };

  // Expõe triggerOverBudget para o pai via ref
  useImperativeHandle(ref, () => ({
    triggerOverBudget: (cats: string[]) => {
      setOverBudgetBanner(cats);
      regenerate(cats);
    },
  }));

  const score = analysis.score;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  const statusClass =
    analysis.status === "Saudável"
      ? "bg-emerald/15 text-emerald ring-emerald/30"
      : analysis.status === "Atenção"
      ? "bg-amber/15 text-amber ring-amber/30"
      : "bg-coral/15 text-coral ring-coral/30";

  return (
    <aside className="glass-card rounded-2xl ring-1 ring-white/10 ring-inset-soft p-6 flex flex-col h-full bg-primary/[0.04] animate-fade-up">
      {overBudgetBanner && overBudgetBanner.length > 0 && (
        <div className="mb-4 p-3 bg-coral/10 ring-1 ring-coral/30 rounded-xl text-[11px] text-coral flex items-start gap-2">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Orçamento extrapolado</strong> em{" "}
            {overBudgetBanner.join(", ")}. Análise de IA gerada automaticamente.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="size-5 bg-gradient-to-tr from-primary to-cyan rounded-full blur-[2px] animate-pulse" />
          <span className="text-sm font-semibold tracking-tight">Ana</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase tracking-wider">
          Pro
        </span>
      </div>

      {/* Score donut */}
      <div className="relative size-40 mx-auto mb-6">
        <svg className="size-40 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="8" />
          {score > 0 && (
            <circle
              key={score}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              className="animate-score-sweep"
              style={
                {
                  ["--score-start" as string]: String(circumference),
                  ["--score-end" as string]: String(offset),
                  filter: "drop-shadow(0 0 8px oklch(0.68 0.22 305 / 0.5))",
                } as React.CSSProperties
              }
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score > 0 ? (
            <>
              <span className="text-4xl font-semibold mono">{score}</span>
              <span className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ${statusClass}`}>
                {analysis.status}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
              Sem dados suficientes
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-6 text-balance">
        {analysis.summary}
      </p>

      <div className="space-y-5 flex-1">
        {analysis.critical.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-coral uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <AlertTriangle className="size-3" /> Pontos Críticos
            </h4>
            <ul className="space-y-1.5">
              {analysis.critical.map((c) => (
                <li key={c} className="flex gap-2 text-xs text-foreground/70 leading-relaxed">
                  <span className="text-coral shrink-0 mt-0.5">●</span> {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="text-[10px] font-bold text-cyan uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Lightbulb className="size-3" /> Sugestões Práticas
          </h4>
          <ul className="space-y-2">
            {analysis.suggestions.slice(0, 2).map((s) => (
              <li
                key={s.title}
                className="p-3 bg-white/5 rounded-lg border border-white/5"
              >
                <p className="text-xs text-foreground font-medium mb-0.5">{s.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-bold text-amber uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Zap className="size-3" /> Riscos — 30 dias
          </h4>
          <ul className="space-y-1.5">
            {analysis.risks.map((r) => (
              <li key={r} className="text-[11px] text-muted-foreground leading-snug">
                — {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber/10 to-transparent border border-amber/20 rounded-xl relative overflow-hidden">
          <p className="text-[10px] font-bold text-amber uppercase mb-2 tracking-widest">
            Dica de Ouro
          </p>
          <p className="text-xs text-foreground/90 leading-relaxed italic text-balance">
            "{analysis.goldenTip}"
          </p>
        </div>

        {apiError && (
          <p className="text-[11px] text-coral text-center">{apiError}</p>
        )}

        <button
          onClick={regenerate}
          disabled={loading}
          className="w-full mt-2 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl ring-1 ring-primary/50 shadow-[0_4px_14px_-2px_oklch(0.68_0.22_305/0.45)] hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Analisando com IA…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" /> Gerar Nova Análise
            </>
          )}
        </button>
      </div>
    </aside>
  );
});
