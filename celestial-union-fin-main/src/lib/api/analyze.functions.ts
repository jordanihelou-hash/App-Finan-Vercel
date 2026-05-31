/**
 * Ana — Assistente Financeira (TanStack Start Server Function)
 * Espelha a lógica de /api/analyze.ts para uso com createServerFn.
 *
 * GEMINI_API_KEY deve estar configurada nas variáveis de ambiente do servidor.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  Analysis,
  AnalysisInput,
  CategoryBreakdown,
  GoalProgress,
  RuleBreakdown,
} from "@/lib/analysis-types";

export type { Analysis };

// ── Schema de validação ───────────────────────────────────────────────────────

const categoryBreakdownSchema = z.object({
  name: z.string(),
  group: z.enum(["necessidades", "estilo_vida", "investimentos"]),
  paid: z.number(),
  forecast: z.number(),
  budget: z.number().optional(),
});

const goalProgressSchema = z.object({
  name: z.string(),
  emoji: z.string(),
  applied: z.number(),
  target: z.number().optional(),
  pct: z.number().optional(),
  isProtective: z.boolean().optional(),
});

const inputSchema = z.object({
  income: z.number(),
  paidExpense: z.number().default(0),
  forecastExpense: z.number().default(0),
  invested: z.number(),
  memberNames: z.array(z.string()).optional().default([]),
  categoryBreakdown: z.array(categoryBreakdownSchema).optional().default([]),
  goalProgress: z.array(goalProgressSchema).optional().default([]),
  overBudgetCategories: z.array(z.string()).optional().default([]),
});

// ── Fallback local ────────────────────────────────────────────────────────────

function computeRuleBreakdown(
  income: number,
  totalExpense: number,
  invested: number,
  breakdown?: CategoryBreakdown[]
): RuleBreakdown {
  if (!income) return { necessidades: 0, estiloDeVida: 0, investimentos: 0 };
  let necessidades = 0;
  let estiloDeVida = 0;
  if (breakdown && breakdown.length > 0) {
    breakdown.forEach((c) => {
      const t = c.paid + c.forecast;
      if (c.group === "necessidades") necessidades += t;
      else if (c.group === "estilo_vida") estiloDeVida += t;
    });
  } else {
    necessidades = totalExpense * 0.6;
    estiloDeVida = totalExpense * 0.4;
  }
  return {
    necessidades: (necessidades / income) * 100,
    estiloDeVida: (estiloDeVida / income) * 100,
    investimentos: (invested / (income * 12)) * 100,
  };
}

function localFallback(input: AnalysisInput): Analysis {
  const { income, paidExpense, forecastExpense, invested, categoryBreakdown, goalProgress, overBudgetCategories } = input;
  const totalExpense = paidExpense + forecastExpense;
  const expenseRatio = income > 0 ? totalExpense / income : 1;
  const savingsRate = Math.max(0, 1 - expenseRatio);
  const investRatio = invested / Math.max(1, income * 12);
  let score = Math.round(38 + savingsRate * 47 + Math.min(15, investRatio * 35));
  score = Math.max(10, Math.min(96, score));
  const status: Analysis["status"] = score >= 75 ? "Saudável" : score >= 52 ? "Atenção" : "Crítico";

  const ruleBreakdown = computeRuleBreakdown(income, totalExpense, invested, categoryBreakdown);

  let budgetAlert: string | undefined;
  if (overBudgetCategories && overBudgetCategories.length > 0) {
    budgetAlert = `Identifiquei extrapolação de orçamento em: ${overBudgetCategories.join(", ")}. Revise os lançamentos "Previstos" restantes para reequilibrar o fluxo antes do fechamento do mês.`;
  } else if (ruleBreakdown.estiloDeVida > 30 && income > 0) {
    budgetAlert = `Estilo de Vida está em ${ruleBreakdown.estiloDeVida.toFixed(0)}% da renda — acima do teto de 30%. Verifique os lançamentos previstos nessa cesta.`;
  } else if (ruleBreakdown.necessidades > 50 && income > 0) {
    budgetAlert = `Necessidades estão em ${ruleBreakdown.necessidades.toFixed(0)}% da renda — acima do teto de 50%. Avalie se há despesas eventuais que inflaram o mês.`;
  }

  const emergencyFund = goalProgress?.find((g) => g.isProtective);
  const critical: string[] = [];
  if (score < 75) critical.push("Despesas projetadas acima do limite recomendado (50% da renda).");
  if (ruleBreakdown.investimentos < 20 && income > 0) critical.push("Alocação em investimentos abaixo de 20% — revise o orçamento de metas.");
  if (emergencyFund && (emergencyFund.pct ?? 0) < 100) critical.push(`Fundo de Emergência em ${(emergencyFund.pct ?? 0).toFixed(0)}% — priorize aportes.`);
  if (critical.length === 0) critical.push("Monitore gastos variáveis — podem escalar até o fim do mês.");

  return {
    score,
    status,
    summary:
      status === "Saudável"
        ? "Excelente sintonia financeira. O planejamento bifásico está equilibrado e os aportes estão dentro da meta."
        : status === "Atenção"
        ? "O plano financeiro está estruturado, mas a projeção do mês indica pontos de atenção. Revise os lançamentos previstos."
        : "Atenção: a projeção de fechamento do mês está sob pressão. Vale uma revisão do orçamento ainda esta semana.",
    critical,
    suggestions: [
      {
        title: "Conciliar Previsto → Pago",
        detail: `Confirme os lançamentos ainda em 'Previsto' para ter visão exata do saldo disponível.`,
      },
      {
        title: "Aporte automático no dia 5",
        detail: "Configure débito automático para a meta de Fundo de Emergência antes de qualquer despesa de estilo de vida.",
      },
    ],
    risks: [
      "Lançamentos 'Previstos' podem mascarar o saldo real — confirme-os à medida que as contas vencem.",
      "Reserva de emergência ideal: 6 meses de despesas mensais.",
    ],
    goldenTip:
      "Casais que revisam juntos o painel Previsto vs. Pago uma vez por semana reduzem surpresas financeiras em até 40%.",
    budgetAlert,
    ruleBreakdown,
  };
}

// ── Prompt da Ana ─────────────────────────────────────────────────────────────

function buildPrompt(input: AnalysisInput): string {
  const { income, paidExpense, forecastExpense, invested, memberNames, categoryBreakdown, goalProgress, overBudgetCategories } = input;
  const totalExpense = paidExpense + forecastExpense;
  const savingsRate = income > 0 ? ((income - totalExpense) / income) * 100 : 0;
  const names = (memberNames ?? []).length > 0 ? (memberNames ?? []).join(" & ") : "o casal";

  const catLines = (categoryBreakdown ?? []).map((c) => {
    const total = c.paid + c.forecast;
    const pct = income > 0 ? ((total / income) * 100).toFixed(1) : "—";
    const over = c.budget && total > c.budget ? ` ⚠ EXTRAPOLADO (+${(((total - c.budget) / c.budget) * 100).toFixed(0)}%)` : "";
    return `  • ${c.name} [${c.group}]: Pago R$${c.paid.toFixed(2)} + Previsto R$${c.forecast.toFixed(2)} = R$${total.toFixed(2)} (${pct}% renda)${over}`;
  }).join("\n");

  const goalLines = (goalProgress ?? []).map((g) =>
    `  • ${g.emoji} ${g.name}${g.isProtective ? " [META RAIZ]" : ""}: R$${g.applied.toFixed(2)}${g.target ? ` / R$${g.target.toFixed(2)} (${(g.pct ?? 0).toFixed(0)}%)` : ""}`
  ).join("\n");

  const overSection = (overBudgetCategories ?? []).length > 0
    ? `\nCATEGORIAS EXTRAPOLADAS: ${overBudgetCategories!.join(", ")}` : "";

  return `Você é Ana, a Inteligência Assistente do ecossistema financeiro do app Cofre do Casal.
Trabalha com dados bifásicos: "Previsto" (planejado) e "Pago" (liquidado).
Regra 50/30/20: Necessidades ≤ 50%, Estilo de Vida ≤ 30%, Investimentos ≥ 20%.
Fundo de Emergência = meta raiz protetora. Responda SOMENTE com JSON válido, sem markdown.

DADOS DO MÊS — ${names}
Receitas: R$${income.toFixed(2)} | Pago: R$${paidExpense.toFixed(2)} | Previsto: R$${forecastExpense.toFixed(2)} | Total projetado: R$${totalExpense.toFixed(2)}
Poupança projetada: ${savingsRate.toFixed(1)}% | Investido (metas): R$${invested.toFixed(2)}${overSection}

CATEGORIAS:
${catLines || "  (sem dados)"}

METAS:
${goalLines || "  (sem metas)"}

INSTRUÇÕES: Valide a regra 50/30/20 com Pago+Previsto. Para "budgetAlert": se houver extrapolação, gere notificação contextual citando categoria e % atingido. Se saudável, retorne null.

JSON esperado:
{"score":<0-100>,"status":<"Saudável"|"Atenção"|"Crítico">,"summary":<2-3 frases com nomes e valores>,"critical":<array 1-3 strings>,"suggestions":<array 2-3 {title,detail}>,"risks":<array 1-2 strings>,"goldenTip":<string>,"budgetAlert":<string|null>,"ruleBreakdown":{"necessidades":<num>,"estiloDeVida":<num>,"investimentos":<num>}}`;
}

// ── Server function ───────────────────────────────────────────────────────────

export const analyzeFinances = createServerFn()
  .validator(inputSchema)
  .handler(async ({ data }): Promise<Analysis> => {
    const input = data as AnalysisInput;
    const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

    if (!apiKey) {
      console.warn("[Ana] GEMINI_API_KEY não configurada — usando fallback local");
      return localFallback(input);
    }

    const prompt = buildPrompt(input);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
          }),
        }
      );

      if (!res.ok) {
        console.error("[Ana] Gemini API error:", res.status, await res.text());
        return localFallback(input);
      }

      const json = await res.json();
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = JSON.parse(text) as Analysis;

      if (typeof parsed.score !== "number" || !parsed.status || !parsed.summary) {
        throw new Error("Shape inválida na resposta do Gemini");
      }

      return parsed;
    } catch (err) {
      console.error("[Ana] Falha ao processar resposta:", err);
      return localFallback(input);
    }
  });
