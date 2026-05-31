/**
 * Vercel Edge Function — Ana, Assistente Financeira do Casal
 * POST /api/analyze
 *
 * Contexto de Operação:
 *   Ana é a inteligência assistente do ecossistema financeiro do app.
 *   Trabalha com dados bifásicos: "Previsto" (planejado) e "Pago" (liquidado).
 *   Aplica a regra 50/30/20: Necessidades / Estilo de Vida / Investimentos por Metas.
 *   O Fundo de Emergência é a meta raiz protetora — prioridade máxima.
 */

export const config = { runtime: "edge" };

import type {
  AnalysisInput,
  Analysis,
  CategoryBreakdown,
  GoalProgress,
  RuleBreakdown,
} from "../src/lib/analysis-types";

export type { Analysis };

// ── Fallback local (sem API key ou falha de rede) ─────────────────────────────

function localFallback(input: AnalysisInput): Analysis {
  const { income, paidExpense, forecastExpense, invested, categoryBreakdown, goalProgress, overBudgetCategories } = input;
  const totalExpense = paidExpense + forecastExpense;

  // Score e breakdown calculados de forma determinística (nunca pela IA)
  const ruleBreakdown = computeRuleBreakdown(income, totalExpense, invested, categoryBreakdown);
  const { score, status } = computeScore(income, totalExpense, ruleBreakdown);

  // Alerta proativo se houver extrapolação
  let budgetAlert: string | undefined;
  if (overBudgetCategories && overBudgetCategories.length > 0) {
    const cats = overBudgetCategories.join(", ");
    budgetAlert = `Identifiquei extrapolação de orçamento em: ${cats}. Revise os lançamentos "Previstos" restantes para reequilibrar o fluxo antes do fechamento do mês.`;
  } else if (ruleBreakdown.estiloDeVida > 30 && income > 0) {
    budgetAlert = `Estilo de Vida está em ${ruleBreakdown.estiloDeVida.toFixed(0)}% da renda — acima do teto de 30%. Verifique os lançamentos previstos nessa cesta.`;
  } else if (ruleBreakdown.necessidades > 50 && income > 0) {
    budgetAlert = `Necessidades estão em ${ruleBreakdown.necessidades.toFixed(0)}% da renda — acima do teto de 50%. Avalie se há despesas eventuais que inflaram o mês.`;
  }

  // Verificar se Fundo de Emergência está sendo alimentado
  const emergencyFund = goalProgress?.find((g) => g.isProtective);
  const emergencyWarning =
    emergencyFund && (emergencyFund.pct ?? 0) < 100
      ? `Fundo de Emergência em ${(emergencyFund.pct ?? 0).toFixed(0)}% da meta — priorize aportes antes das demais metas.`
      : null;

  const critical: string[] = [];
  if (score < 75) critical.push("Despesas projetadas acima do limite recomendado (50% da renda).");
  if (ruleBreakdown.investimentos < 20 && income > 0) critical.push("Alocação em investimentos abaixo de 20% — revise o orçamento de metas.");
  if (emergencyWarning) critical.push(emergencyWarning);
  if (critical.length === 0) critical.push("Monitore gastos variáveis — podem escalar até o fim do mês.");

  return {
    score,
    status,
    summary:
      status === "Saudável"
        ? "Excelente sintonia financeira. O planejamento bifásico do casal está equilibrado e os aportes estão dentro da meta."
        : status === "Atenção"
        ? "O plano financeiro está estruturado, mas a projeção do mês indica pontos de atenção. Revise os lançamentos previstos."
        : "Atenção: a projeção de fechamento do mês está sob pressão. Vale uma revisão do orçamento ainda esta semana.",
    critical,
    suggestions: [
      {
        title: "Conciliar Previsto → Pago",
        detail: `Confirme os ${paidExpense < totalExpense ? "R$ " + (totalExpense - paidExpense).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + " em lançamentos ainda 'Previstos'" : "lançamentos do mês"} para ter visão exata do saldo disponível.`,
      },
      {
        title: "Aporte automático no dia 5",
        detail: "Configure débito automático para a meta de Fundo de Emergência antes de qualquer despesa de estilo de vida.",
      },
    ],
    risks: [
      "Lançamentos em estado 'Previsto' podem mascarar o saldo real — confirme-os à medida que as contas vencem.",
      "Reserva de emergência ideal: 6 meses de despesas mensais.",
    ],
    goldenTip:
      "Casais que revisam juntos o painel Previsto vs. Pago uma vez por semana reduzem surpresas financeiras em até 40%. Marquem uma 'data financeira' quinzenal de 20 minutos.",
    budgetAlert,
    ruleBreakdown,
  };
}

function computeRuleBreakdown(
  income: number,
  totalExpense: number,
  _invested: number,
  breakdown?: CategoryBreakdown[]
): RuleBreakdown {
  if (!income || income === 0) return { necessidades: 0, estiloDeVida: 0, investimentos: 0 };

  let necessidades = 0;
  let estiloDeVida = 0;

  if (breakdown && breakdown.length > 0) {
    breakdown.forEach((c) => {
      const total = c.paid + c.forecast;
      if (c.group === "necessidades") necessidades += total;
      else if (c.group === "estilo_vida") estiloDeVida += total;
    });
    // Categorias sem grupo atribuído: se totalExpense > necessidades + estiloDeVida,
    // o restante das despesas vai para necessidades (estimativa conservadora)
    const categorized = necessidades + estiloDeVida;
    if (categorized < totalExpense) necessidades += totalExpense - categorized;
  } else {
    // Sem breakdown: estimativa 60/40
    necessidades = totalExpense * 0.6;
    estiloDeVida = totalExpense * 0.4;
  }

  // Investimentos = taxa de poupança do mês (o que não foi consumido em despesas)
  // Esta é a interpretação correta da regra 50/30/20 para fluxo de caixa mensal
  const investimentos = Math.max(0, income - totalExpense);

  return {
    necessidades: Math.min(200, (necessidades / income) * 100),
    estiloDeVida: Math.min(200, (estiloDeVida / income) * 100),
    investimentos: Math.min(100, (investimentos / income) * 100),
  };
}

/** Calcula score de forma determinística a partir dos dados financeiros */
function computeScore(
  income: number,
  totalExpense: number,
  ruleBreakdown: RuleBreakdown
): { score: number; status: Analysis["status"] } {
  if (income === 0 && totalExpense === 0) return { score: 0, status: "Atenção" };

  const expenseRatio = income > 0 ? totalExpense / income : 1;
  const savingsRate = Math.max(0, 1 - expenseRatio);

  // Penalidades por extrapolar os tetos da regra 50/30/20
  const necPenalty = ruleBreakdown.necessidades > 50 ? (ruleBreakdown.necessidades - 50) * 0.4 : 0;
  const esvPenalty = ruleBreakdown.estiloDeVida > 30 ? (ruleBreakdown.estiloDeVida - 30) * 0.5 : 0;
  // Bônus por investir acima de 20%
  const invBonus = ruleBreakdown.investimentos >= 20 ? Math.min(10, (ruleBreakdown.investimentos - 20) * 0.2) : 0;

  let score = Math.round(40 + savingsRate * 45 - necPenalty - esvPenalty + invBonus);
  score = Math.max(10, Math.min(96, score));

  const status: Analysis["status"] =
    score >= 75 ? "Saudável" : score >= 52 ? "Atenção" : "Crítico";

  return { score, status };
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
    const overBudget = c.budget && total > c.budget ? ` ⚠ EXTRAPOLADO (+${(((total - c.budget) / c.budget) * 100).toFixed(0)}%)` : "";
    return `  • ${c.name} [${c.group}]: Pago R$${c.paid.toFixed(2)} + Previsto R$${c.forecast.toFixed(2)} = R$${total.toFixed(2)} (${pct}% da renda)${overBudget}`;
  }).join("\n");

  const goalLines = (goalProgress ?? []).map((g) => {
    const pctStr = g.pct !== undefined ? `${g.pct.toFixed(0)}%` : "—";
    const protective = g.isProtective ? " [META RAIZ PROTETORA]" : "";
    return `  • ${g.emoji} ${g.name}${protective}: R$${g.applied.toFixed(2)} aplicados${g.target ? ` / meta R$${g.target.toFixed(2)} (${pctStr})` : ""}`;
  }).join("\n");

  const overBudgetSection = (overBudgetCategories ?? []).length > 0
    ? `\nCATEGORIAS EXTRAPOLADAS NO CICLO: ${overBudgetCategories!.join(", ")}`
    : "";

  return `Você é Ana, a Inteligência Assistente do ecossistema financeiro de casais do app Cofre do Casal.
Seus dados de entrada refletem dois estados de conciliação: "Previsto" (planejado) e "Pago" (liquidado/confirmado).
Você aplica a regra 50/30/20: Necessidades ≤ 50%, Estilo de Vida ≤ 30%, Investimentos por Metas ≥ 20%.
O Fundo de Emergência é a meta raiz protetora — deve ser priorizado antes de qualquer meta de consumo.
Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON.

═══════════════════════════════════════
DADOS DO MÊS — ${names}
═══════════════════════════════════════
Receitas totais:      R$ ${income.toFixed(2)}
Despesas confirmadas (Pago):    R$ ${paidExpense.toFixed(2)} (${income > 0 ? ((paidExpense / income) * 100).toFixed(1) : 0}% da renda)
Despesas planejadas (Previsto): R$ ${forecastExpense.toFixed(2)} (${income > 0 ? ((forecastExpense / income) * 100).toFixed(1) : 0}% da renda)
Projeção total de despesas:     R$ ${totalExpense.toFixed(2)} (${income > 0 ? ((totalExpense / income) * 100).toFixed(1) : 0}% da renda)
Taxa de poupança projetada:     ${savingsRate.toFixed(1)}%
Patrimônio investido (metas):   R$ ${invested.toFixed(2)}
${overBudgetSection}

BREAKDOWN POR CATEGORIA (Pago + Previsto):
${catLines || "  (sem dados de categoria)"}

PROGRESSO DAS METAS DE INVESTIMENTO:
${goalLines || "  (sem metas cadastradas)"}

═══════════════════════════════════════
INSTRUÇÕES DE ANÁLISE:
1. Valide se o planejamento (Previsto) respeita os tetos 50/30/20.
2. Identifique se há categorias extrapoladas e nomeie-as na notificação proativa.
3. Priorize o Fundo de Emergência antes de validar metas de consumo.
4. O campo "budgetAlert" deve ser uma notificação contextual clara e acionável, como:
   "Identifiquei que a categoria [Nome] atingiu [X]% do teto. O limite foi ultrapassado. Sugiro revisar os itens Previstos para reequilibrar o fluxo."
   Se nenhuma categoria extrapolou e o plano está saudável, omita "budgetAlert" (null).
5. "ruleBreakdown" deve refletir Necessidades/EstiloDeVida/Investimentos como % da renda bruta, considerando Pago + Previsto.
═══════════════════════════════════════

IMPORTANTE: "score", "status" e "ruleBreakdown" são calculados automaticamente pelo sistema com base nos dados — você NÃO precisa calculá-los, coloque qualquer valor válido (serão substituídos). Foque sua análise em "summary", "critical", "suggestions", "risks", "goldenTip" e "budgetAlert".

Retorne exatamente este JSON:
{
  "score": 0,
  "status": "Saudável",
  "summary": <2-3 frases sobre a situação do casal, cite os nomes e os valores reais>,
  "critical": <array 1-3 strings com pontos críticos específicos e valores reais>,
  "suggestions": <array 2-3 objetos {"title": string, "detail": string} com ações práticas e valores>,
  "risks": <array 1-2 strings com riscos nos próximos 30 dias>,
  "goldenTip": <dica motivacional personalizada para o casal>,
  "budgetAlert": <string contextual acionável | null>,
  "ruleBreakdown": {"necessidades": 0, "estiloDeVida": 0, "investimentos": 0}
}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: AnalysisInput;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  // Normalise — campos legados (income/expense sem breakdown) ainda funcionam
  const input: AnalysisInput = {
    income: body.income ?? 0,
    paidExpense: body.paidExpense ?? (body as unknown as Record<string, number>).expense ?? 0,
    forecastExpense: body.forecastExpense ?? 0,
    invested: body.invested ?? 0,
    memberNames: body.memberNames ?? [],
    categoryBreakdown: body.categoryBreakdown ?? [],
    goalProgress: body.goalProgress ?? [],
    overBudgetCategories: body.overBudgetCategories ?? [],
  };

  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return new Response(JSON.stringify(localFallback(input)), { headers });
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
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      }
    );

    if (!res.ok) {
      console.error("[Ana] Gemini error:", res.status, await res.text());
      return new Response(JSON.stringify(localFallback(input)), { headers });
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as Analysis;

    if (!parsed.summary) {
      throw new Error("Invalid response shape from Gemini");
    }

    // Score e ruleBreakdown são SEMPRE calculados deterministicamente — nunca pela IA
    // Isso garante consistência total entre chamadas com os mesmos dados
    const ruleBreakdown = computeRuleBreakdown(input.income, input.paidExpense + input.forecastExpense, input.invested, input.categoryBreakdown);
    const { score, status } = computeScore(input.income, input.paidExpense + input.forecastExpense, ruleBreakdown);
    parsed.score = score;
    parsed.status = status;
    parsed.ruleBreakdown = ruleBreakdown;

    return new Response(JSON.stringify(parsed), { headers });
  } catch (err) {
    console.error("[Ana] Failed:", err);
    return new Response(JSON.stringify(localFallback(input)), { headers });
  }
}
