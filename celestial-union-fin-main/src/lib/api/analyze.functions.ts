/**
 * Gemini Financial Advisor — server function
 * Runs server-side (Nitro / Cloudflare Workers) via TanStack Start's
 * createServerFn. Calls Gemini 2.5 Flash REST API with the couple's
 * monthly financial data and returns a structured Analysis object.
 *
 * Required env var: GEMINI_API_KEY
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Analysis {
  score: number;
  status: "Saudável" | "Atenção" | "Crítico";
  summary: string;
  critical: string[];
  suggestions: { title: string; detail: string }[];
  risks: string[];
  goldenTip: string;
}

// ── Fallback (when API key is missing or call fails) ──────────────────────────

function localFallback(
  income: number,
  expense: number,
  invested: number
): Analysis {
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
        ? "Excelente sintonia. Vocês estão poupando acima da média e diversificando bem o patrimônio."
        : status === "Atenção"
        ? "A parceria financeira está estável, mas alguns padrões de consumo merecem revisão."
        : "Atenção: as despesas estão consumindo quase toda a renda. Vale uma reunião de casal.",
    critical:
      score < 75
        ? [
            "Despesas acima do limite recomendado (50% da renda).",
            "Reserva de emergência pode estar insuficiente.",
          ]
        : ["Monitore gastos variáveis — podem escalar no fim do mês."],
    suggestions: [
      {
        title: "Automatizar aporte mensal",
        detail: "Defina um aporte fixo no dia 5 para investimentos de renda fixa.",
      },
      {
        title: "Revisar assinaturas",
        detail: "Audite serviços recorrentes e cancele os que não usam todo mês.",
      },
    ],
    risks: [
      "Sazonalidade pode elevar despesas em até 15% no próximo mês.",
      "Reserva de emergência ideal: 6 meses de despesas mensais.",
    ],
    goldenTip:
      "Casais que alinham metas financeiras juntos investem em média 31% mais ao ano. Marquem uma 'data financeira' quinzenal de 20 minutos.",
  };
}

// ── Server function ───────────────────────────────────────────────────────────

const inputSchema = z.object({
  income: z.number(),
  expense: z.number(),
  invested: z.number(),
  memberNames: z.array(z.string()).optional().default([]),
});

export const analyzeFinances = createServerFn()
  .validator(inputSchema)
  .handler(async ({ data }): Promise<Analysis> => {
    const { income, expense, invested, memberNames } = data;
    const apiKey = process.env.GEMINI_API_KEY ?? "";

    if (!apiKey) {
      console.warn("[analyzeFinances] GEMINI_API_KEY not set — using local fallback");
      return localFallback(income, expense, invested);
    }

    const savingsRate =
      income > 0 ? ((income - expense) / income) * 100 : 0;
    const names = memberNames.length > 0 ? memberNames.join(" & ") : "o casal";

    const prompt = `Você é um consultor financeiro especializado em finanças de casais brasileiros.
Analise os dados financeiros do mês atual e responda SOMENTE com um objeto JSON válido — sem markdown, sem explicações fora do JSON.

Dados do mês:
- Casal: ${names}
- Receitas totais: R$ ${income.toFixed(2)}
- Despesas totais: R$ ${expense.toFixed(2)}
- Taxa de poupança: ${savingsRate.toFixed(1)}%
- Patrimônio investido (total acumulado): R$ ${invested.toFixed(2)}

Retorne um JSON com exatamente esta estrutura:
{
  "score": <número 0-100 representando saúde financeira>,
  "status": <"Saudável" | "Atenção" | "Crítico">,
  "summary": <parágrafo de 2-3 frases sobre a situação do casal, mencione os nomes se possível>,
  "critical": <array de 1-3 strings com pontos críticos específicos para esses dados>,
  "suggestions": <array de 2-3 objetos {title: string, detail: string} com sugestões práticas e valores reais>,
  "risks": <array de 1-2 strings com riscos financeiros para os próximos 30 dias>,
  "goldenTip": <string com uma dica motivacional personalizada para o casal>
}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("[analyzeFinances] Gemini API error:", res.status, errorText);
        return localFallback(income, expense, invested);
      }

      const json = await res.json();
      const text: string =
        json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      const parsed = JSON.parse(text) as Analysis;

      // Validate required fields are present
      if (
        typeof parsed.score !== "number" ||
        !parsed.status ||
        !parsed.summary
      ) {
        throw new Error("Invalid response shape from Gemini");
      }

      return parsed;
    } catch (err) {
      console.error("[analyzeFinances] Failed to parse Gemini response:", err);
      return localFallback(income, expense, invested);
    }
  });
