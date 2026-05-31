/**
 * GeminiAdvisor — Ana, Assistente Financeira do Casal
 *
 * UI atualizada para o framework 50/30/20 bifásico (Previsto / Pago).
 * Inclui:
 *   – Medidores da regra 50/30/20
 *   – Card de notificação proativa (budgetAlert)
 *   – Score + resumo + sugestões + riscos + dica de ouro
 *   – triggerOverBudget exposto via ref para o CategoryBudgetChart
 */

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useStore } from "@/lib/store";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Zap,
  Bell,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import type { Analysis, AnalysisInput, CategoryBreakdown, GoalProgress } from "@/lib/analysis-types";
import type { RuleBreakdown } from "@/lib/analysis-types";

// ── Local fallback (cliente, sem rede) ────────────────────────────────────────

/** Score e ruleBreakdown calculados deterministicamente — mesma lógica do servidor */
function computeLocalBreakdown(income: number, totalExpense: number): import("@/lib/analysis-types").RuleBreakdown {
  if (income === 0) return { necessidades: 0, estiloDeVida: 0, investimentos: 0 };
  const necessidades = totalExpense * 0.6;
  const estiloDeVida = totalExpense * 0.4;
  const investimentos = Math.max(0, income - totalExpense);
  return {
    necessidades: Math.min(200, (necessidades / income) * 100),
    estiloDeVida: Math.min(200, (estiloDeVida / income) * 100),
    investimentos: Math.min(100, (investimentos / income) * 100),
  };
}

function localScore(
  income: number,
  paidExpense: number,
  forecastExpense: number,
  invested: number
): Analysis {
  const totalExpense = paidExpense + forecastExpense;

  if (income === 0 && totalExpense === 0 && invested === 0) {
    return {
      score: 0,
      status: "Atenção",
      summary:
        "Adicione seus lançamentos e contas para receber uma análise personalizada do casal.",
      critical: [],
      suggestions: [
        { title: "Comece pelo básico", detail: "Cadastre suas contas bancárias na aba Contas." },
        { title: "Registre receitas", detail: "Adicione seu salário e outras entradas na aba Lançar." },
      ],
      risks: ["Sem dados históricos não é possível detectar riscos."],
      goldenTip:
        "Casais que conversam sobre dinheiro com leveza investem 31% mais ao ano. Registre seus primeiros lançamentos.",
    };
  }

  const ruleBreakdown = computeLocalBreakdown(income, totalExpense);
  const expenseRatio = income > 0 ? totalExpense / income : 1;
  const savingsRate = Math.max(0, 1 - expenseRatio);
  const necPenalty = ruleBreakdown.necessidades > 50 ? (ruleBreakdown.necessidades - 50) * 0.4 : 0;
  const esvPenalty = ruleBreakdown.estiloDeVida > 30 ? (ruleBreakdown.estiloDeVida - 30) * 0.5 : 0;
  const invBonus = ruleBreakdown.investimentos >= 20 ? Math.min(10, (ruleBreakdown.investimentos - 20) * 0.2) : 0;
  let score = Math.round(40 + savingsRate * 45 - necPenalty - esvPenalty + invBonus);
  score = Math.max(10, Math.min(96, score));
  const status: Analysis["status"] =
    score >= 75 ? "Saudável" : score >= 52 ? "Atenção" : "Crítico";

  return {
    score,
    status,
    ruleBreakdown,
    summary:
      status === "Saudável"
        ? "Excelente sintonia. O plano bifásico do casal está equilibrado."
        : status === "Atenção"
        ? "Parceria financeira estável, mas a projeção do mês tem pontos de atenção."
        : "Atenção: despesas projetadas elevadas. Vale revisar os lançamentos previstos.",
    critical:
      score < 75
        ? ["Despesas projetadas acima do limite (50% da renda).", "Revise lançamentos Previstos."]
        : ["Monitore gastos variáveis — podem escalar no fim do mês."],
    suggestions: [
      { title: "Conciliar Previsto → Pago", detail: "Confirme os lançamentos pendentes para ter visão exata do saldo." },
      { title: "Revisar assinaturas", detail: "Audite serviços recorrentes e cancele os que não usam." },
    ],
    risks: [
      "Lançamentos 'Previstos' podem mascarar o saldo real.",
      "Reserva de emergência ideal: 6 meses de despesas mensais.",
    ],
    goldenTip:
      "Casais que revisam juntos o painel Previsto vs. Pago uma vez por semana reduzem surpresas em até 40%.",
  };
}

// ── Tipos de props ────────────────────────────────────────────────────────────

export interface GeminiAdvisorHandle {
  triggerOverBudget: (overCategories: string[]) => void;
}

export interface GeminiAdvisorProps {
  income: number;
  /** Despesas com status "pago" */
  paidExpense: number;
  /** Despesas com status "previsto" */
  forecastExpense: number;
  invested: number;
  categoryBreakdown?: CategoryBreakdown[];
  goalProgress?: GoalProgress[];
}

// ── Componente ────────────────────────────────────────────────────────────────

export const GeminiAdvisor = forwardRef<GeminiAdvisorHandle, GeminiAdvisorProps>(
  function GeminiAdvisorInner(
    { income, paidExpense, forecastExpense, invested, categoryBreakdown, goalProgress },
    ref
  ) {
    const { state } = useStore();
    // Ana começa silenciosa — só exibe análise após o usuário clicar em "Gerar"
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [overBudgetBanner, setOverBudgetBanner] = useState<string[] | null>(null);

    const regenerate = async (overCats?: string[]) => {
      setLoading(true);
      setApiError(null);
      try {
        const payload: AnalysisInput = {
          income,
          paidExpense,
          forecastExpense,
          invested,
          memberNames: state.members.map((m) => m.name),
          categoryBreakdown: categoryBreakdown ?? [],
          goalProgress: goalProgress ?? [],
          overBudgetCategories: overCats ?? [],
        };
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result: Analysis = await res.json();
        setAnalysis(result);
        if (result.budgetAlert) setOverBudgetBanner(overCats ?? []);
      } catch (err) {
        console.error("[Ana] /api/analyze error:", err);
        setApiError("Não foi possível gerar análise. Verifique a chave Gemini.");
      }
      setLoading(false);
    };

    // Ref exposto para o CategoryBudgetChart
    // Só dispara auto-análise se o usuário já tiver solicitado uma análise antes
    useImperativeHandle(ref, () => ({
      triggerOverBudget: (cats: string[]) => {
        setOverBudgetBanner(cats);
        if (analysis !== null) regenerate(cats);
      },
    }));

    const score = analysis?.score ?? 0;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (score / 100) * circumference;

    const statusClass =
      analysis?.status === "Saudável"
        ? "bg-emerald/15 text-emerald ring-emerald/30"
        : analysis?.status === "Atenção"
        ? "bg-amber/15 text-amber ring-amber/30"
        : "bg-coral/15 text-coral ring-coral/30";

    return (
      <aside className="glass-card rounded-2xl ring-1 ring-white/10 ring-inset-soft p-6 flex flex-col gap-5 bg-primary/[0.04] animate-fade-up">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-5 bg-gradient-to-tr from-primary to-cyan rounded-full blur-[2px] animate-pulse" />
            <span className="text-sm font-semibold tracking-tight">Ana</span>
            <span className="text-[9px] text-muted-foreground font-medium">Assistente Financeira</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase tracking-wider">
            Pro
          </span>
        </div>

        {/* Estado inicial — silencioso até o usuário pedir análise */}
        {!analysis && !loading && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="size-14 rounded-2xl bg-primary/10 grid place-items-center">
              <Sparkles className="size-6 text-primary/60" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed text-balance">
              Clique em <strong className="text-foreground">Analisar com IA</strong> para receber uma análise personalizada do seu planejamento financeiro.
            </p>
          </div>
        )}

        {/* Notificação proativa de extrapolação */}
        {analysis?.budgetAlert && (
          <div className="flex gap-2 p-3 bg-coral/10 ring-1 ring-coral/30 rounded-xl text-[11px] text-coral animate-fade-up">
            <Bell className="size-3.5 shrink-0 mt-0.5" />
            <span>{analysis.budgetAlert}</span>
          </div>
        )}

        {/* Score donut — só mostra após análise */}
        {analysis && (
          <>
            <div className="relative size-36 mx-auto">
              <svg className="size-36 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="8" />
                {score > 0 && (
                  <circle
                    key={score}
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    className="animate-score-sweep"
                    style={{
                      ["--score-start" as string]: String(circumference),
                      ["--score-end" as string]: String(offset),
                      filter: "drop-shadow(0 0 8px oklch(0.68 0.22 305 / 0.5))",
                    } as React.CSSProperties}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-semibold mono">{score}</span>
                <span className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ${statusClass}`}>
                  {analysis.status}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed text-balance -mt-1">
              {analysis.summary}
            </p>

            {/* Regra 50/30/20 */}
            {analysis.ruleBreakdown && (
              <Rule5030 breakdown={analysis.ruleBreakdown} />
            )}

            <div className="space-y-4">
              {/* Pontos críticos */}
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

              {/* Sugestões */}
              <div>
                <h4 className="text-[10px] font-bold text-cyan uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Lightbulb className="size-3" /> Sugestões Práticas
                </h4>
                <ul className="space-y-2">
                  {analysis.suggestions.slice(0, 3).map((s) => (
                    <li key={s.title} className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <p className="text-xs text-foreground font-medium mb-0.5">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{s.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Riscos */}
              <div>
                <h4 className="text-[10px] font-bold text-amber uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Zap className="size-3" /> Riscos — 30 dias
                </h4>
                <ul className="space-y-1.5">
                  {analysis.risks.map((r) => (
                    <li key={r} className="text-[11px] text-muted-foreground leading-snug">— {r}</li>
                  ))}
                </ul>
              </div>

              {/* Dica de Ouro */}
              <div className="p-4 bg-gradient-to-br from-amber/10 to-transparent border border-amber/20 rounded-xl">
                <p className="text-[10px] font-bold text-amber uppercase mb-2 tracking-widest">Dica de Ouro</p>
                <p className="text-xs text-foreground/90 leading-relaxed italic text-balance">
                  "{analysis.goldenTip}"
                </p>
              </div>
            </div>
          </>
        )}

        {apiError && (
          <p className="text-[11px] text-coral text-center">{apiError}</p>
        )}

        <button
          onClick={() => regenerate()}
          disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl ring-1 ring-primary/50 shadow-[0_4px_14px_-2px_oklch(0.68_0.22_305/0.45)] hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="size-3.5 animate-spin" /> Analisando com IA…</>
          ) : (
            <><Sparkles className="size-3.5" /> {analysis ? "Nova Análise" : "Analisar com IA"}</>
          )}
        </button>
      </aside>
    );
  }
);

// ── Sub-componente: Medidores 50/30/20 ────────────────────────────────────────

function Rule5030({ breakdown }: { breakdown: RuleBreakdown }) {
  const rules: {
    key: keyof RuleBreakdown;
    label: string;
    limit: number;
    icon: React.ReactNode;
    colorOk: string;
    colorOver: string;
  }[] = [
    {
      key: "necessidades",
      label: "Necessidades",
      limit: 50,
      icon: <ShieldCheck className="size-3" />,
      colorOk: "bg-primary/70",
      colorOver: "bg-coral",
    },
    {
      key: "estiloDeVida",
      label: "Estilo de Vida",
      limit: 30,
      icon: <TrendingUp className="size-3" />,
      colorOk: "bg-amber/70",
      colorOver: "bg-coral",
    },
    {
      key: "investimentos",
      label: "Investimentos",
      limit: 20,
      icon: <Sparkles className="size-3" />,
      colorOk: "bg-emerald/70",
      colorOver: "bg-emerald",
    },
  ];

  return (
    <div className="p-4 bg-white/[0.03] ring-1 ring-white/8 rounded-xl space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        Regra 50 · 30 · 20
      </p>
      {rules.map((r) => {
        const val = breakdown[r.key];
        const isInvestimentos = r.key === "investimentos";
        // Para investimentos: abaixo do limite é "over" (underinvesting); para demais: acima é "over"
        const isOver = isInvestimentos ? val < r.limit : val > r.limit;
        const barPct = isInvestimentos
          ? Math.min(100, (val / r.limit) * 100)
          : Math.min(100, (val / r.limit) * 100);

        return (
          <div key={r.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                <span className={isOver && r.key !== "investimentos" ? "text-coral" : isOver && r.key === "investimentos" ? "text-amber" : "text-foreground/60"}>
                  {r.icon}
                </span>
                {r.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`mono text-[10px] font-semibold ${isOver && r.key !== "investimentos" ? "text-coral" : isOver ? "text-amber" : "text-foreground"}`}>
                  {val.toFixed(0)}%
                </span>
                <span className="text-[9px] text-muted-foreground">/ {r.limit}%</span>
                {isOver && r.key !== "investimentos" && (
                  <span className="text-[8px] text-coral font-bold bg-coral/15 px-1 py-0.5 rounded">
                    +{(val - r.limit).toFixed(0)}%
                  </span>
                )}
                {isOver && r.key === "investimentos" && (
                  <span className="text-[8px] text-amber font-bold bg-amber/15 px-1 py-0.5 rounded">
                    -{(r.limit - val).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  r.key === "investimentos"
                    ? val >= r.limit ? r.colorOk : "bg-amber/50"
                    : isOver ? r.colorOver : r.colorOk
                }`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
