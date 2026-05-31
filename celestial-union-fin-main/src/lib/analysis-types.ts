/**
 * Tipos compartilhados entre o endpoint /api/analyze (Vercel Edge),
 * o server function TanStack e o componente GeminiAdvisor.
 */

// ── Payload de entrada ────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  name: string;
  /** Enquadramento 50/30/20 */
  group: "necessidades" | "estilo_vida" | "investimentos";
  /** Valor já confirmado como Pago no mês */
  paid: number;
  /** Valor ainda em estado Previsto para o mês */
  forecast: number;
  /** Teto orçamentário mensal da categoria (opcional) */
  budget?: number;
}

export interface GoalProgress {
  name: string;
  emoji: string;
  /** Total aplicado nesta meta */
  applied: number;
  /** Valor-alvo da meta (opcional) */
  target?: number;
  /** % de conclusão (0–100), calculado pelo frontend */
  pct?: number;
  /** true = meta raiz protetora (Fundo de Emergência) */
  isProtective?: boolean;
}

export interface AnalysisInput {
  income: number;
  /** Soma de despesas com status "pago" */
  paidExpense: number;
  /** Soma de despesas com status "previsto" */
  forecastExpense: number;
  /** Total do patrimônio investido */
  invested: number;
  memberNames?: string[];
  categoryBreakdown?: CategoryBreakdown[];
  goalProgress?: GoalProgress[];
  /** Categorias que já ultrapassaram o teto no ciclo atual */
  overBudgetCategories?: string[];
}

// ── Resposta da IA ────────────────────────────────────────────────────────────

/** Gauge da regra 50/30/20 — cada campo é % da renda bruta */
export interface RuleBreakdown {
  necessidades: number;
  estiloDeVida: number;
  investimentos: number;
}

export interface Analysis {
  score: number;
  status: "Saudável" | "Atenção" | "Crítico";
  summary: string;
  critical: string[];
  suggestions: { title: string; detail: string }[];
  risks: string[];
  goldenTip: string;
  /**
   * Notificação proativa contextual — disparada quando Ana detecta
   * extrapolação de orçamento ou desvio da regra 50/30/20.
   * Exemplo: "Identifiquei que Estilo de Vida atingiu 38%…"
   */
  budgetAlert?: string;
  /**
   * Distribuição atual da renda (%) nas três cestas da regra 50/30/20.
   * Considera Pago + Previsto para projetar o fechamento do mês.
   */
  ruleBreakdown?: RuleBreakdown;
}
