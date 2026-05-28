/**
 * Vercel Edge Function — Gemini Financial Advisor
 * POST /api/analyze
 *
 * Substitui o createServerFn do TanStack Start.
 * Roda na edge do Vercel — sem cold start, sem Node.js.
 *
 * Body: { income: number, expense: number, invested: number, memberNames?: string[] }
 */

export const config = { runtime: "edge" };

interface AnalysisInput {
  income: number;
  expense: number;
  invested: number;
  memberNames?: string[];
}

export interface Analysis {
  score: number;
  status: "Saudável" | "Atenção" | "Crítico";
  summary: string;
  critical: string[];
  suggestions: { title: string; detail: string }[];
  risks: string[];
  goldenTip: string;
}

function localFallback(income: number, expense: number, invested: number): Analysis {
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
        ? ["Despesas acima do limite recomendado (50% da renda).", "Reserva de emergência pode estar insuficiente."]
        : ["Monitore gastos variáveis — podem escalar no fim do mês."],
    suggestions: [
      { title: "Automatizar aporte mensal", detail: "Defina um aporte fixo no dia 5 para investimentos de renda fixa." },
      { title: "Revisar assinaturas", detail: "Audite serviços recorrentes e cancele os que não usam todo mês." },
    ],
    risks: [
      "Sazonalidade pode elevar despesas em até 15% no próximo mês.",
      "Reserva de emergência ideal: 6 meses de despesas mensais.",
    ],
    goldenTip:
      "Casais que alinham metas financeiras juntos investem em média 31% mais ao ano. Marquem uma 'data financeira' quinzenal de 20 minutos.",
  };
}

export default async function handler(req: Request): Promise<Response> {
  // CORS
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: AnalysisInput;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const { income = 0, expense = 0, invested = 0, memberNames = [] } = body;
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (!apiKey) {
    return new Response(JSON.stringify(localFallback(income, expense, invested)), { headers });
  }

  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
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
  "summary": <parágrafo de 2-3 frases sobre a situação do casal>,
  "critical": <array de 1-3 strings com pontos críticos específicos>,
  "suggestions": <array de 2-3 objetos {title: string, detail: string}>,
  "risks": <array de 1-2 strings com riscos para os próximos 30 dias>,
  "goldenTip": <string com uma dica motivacional para o casal>
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        }),
      }
    );

    if (!res.ok) {
      console.error("[analyze] Gemini error:", res.status);
      return new Response(JSON.stringify(localFallback(income, expense, invested)), { headers });
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as Analysis;

    if (typeof parsed.score !== "number" || !parsed.status || !parsed.summary) {
      throw new Error("Invalid Gemini response shape");
    }

    return new Response(JSON.stringify(parsed), { headers });
  } catch (err) {
    console.error("[analyze] Failed:", err);
    return new Response(JSON.stringify(localFallback(income, expense, invested)), { headers });
  }
}
