/**
 * Edge Function: whatsapp-webhook
 *
 * Recebe mensagens da Evolution API, identifica o usuário pelo número,
 * usa Gemini para interpretar a mensagem e salva a transação no Supabase.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Envia mensagem de volta pelo WhatsApp ─────────────────────────────────────

async function sendWhatsAppMessage(to: string, text: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: to,
      text,
    }),
  });
}

// ── Interpreta mensagem com Gemini ────────────────────────────────────────────

interface ParsedTransaction {
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
}

async function parseMessageWithGemini(
  message: string,
  categories: { id: string; name: string; type: string }[]
): Promise<ParsedTransaction | null> {
  const catList = categories
    .map((c) => `- ${c.name} (${c.type === "income" ? "receita" : "despesa"})`)
    .join("\n");

  const prompt = `Voce e a ANA, assistente financeira pessoal do Cofre do Casal. Voce e educada, inteligente, muito precisa e extremamente detalhista com valores financeiros — sempre registra centavos corretamente e nunca arredonda sem o usuario pedir.

Analise a mensagem do usuario e extraia a transacao financeira.

Mensagem: "${message}"

Categorias disponiveis:
${catList}

Responda APENAS com JSON valido neste formato exato (sem markdown, sem explicacao):
{
  "type": "expense" ou "income",
  "amount": numero com ate 2 casas decimais (ex: 45.90),
  "description": "descricao clara e objetiva da transacao",
  "category": "nome exato de uma das categorias da lista acima"
}

Se a mensagem nao for sobre uma transacao financeira, responda apenas: null`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text || text === "null") return null;

  try {
    return JSON.parse(text) as ParsedTransaction;
  } catch {
    // Tenta extrair JSON se vier com texto extra
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ParsedTransaction;
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Filtra apenas mensagens de texto recebidas (não enviadas pelo bot)
  const event = body.event as string;
  if (event !== "messages.upsert") {
    return new Response("OK", { status: 200 });
  }

  const data = body.data as Record<string, unknown>;
  const key = data?.key as Record<string, unknown>;
  const fromMe = key?.fromMe as boolean;
  if (fromMe) return new Response("OK", { status: 200 }); // ignora msgs enviadas

  const messageType = (data?.messageType as string) ?? "";
  if (messageType !== "conversation" && messageType !== "extendedTextMessage") {
    return new Response("OK", { status: 200 }); // ignora áudio, imagem, etc.
  }

  // Extrai número e texto da mensagem
  const remoteJid = key?.remoteJid as string; // ex: "5511999990001@s.whatsapp.net"
  const phoneRaw = remoteJid?.replace("@s.whatsapp.net", "").replace("@c.us", "") ?? "";
  const messageContent = data?.message as Record<string, unknown>;
  const text: string =
    (messageContent?.conversation as string) ??
    (messageContent?.extendedTextMessage as Record<string, unknown>)?.text as string ??
    "";

  if (!phoneRaw || !text) return new Response("OK", { status: 200 });

  // Normaliza número: remove código do país se for Brasil (55) e adiciona de volta
  // para buscar no formato que o usuário cadastrou (ex: 11999990001)
  const phoneVariants = [
    phoneRaw,                                    // 5511999990001
    phoneRaw.startsWith("55") ? phoneRaw.slice(2) : phoneRaw, // 11999990001
  ];

  // Busca usuário pelo número cadastrado
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, couple_id, name")
    .or(phoneVariants.map((p) => `phone.eq.${p}`).join(","));

  if (!profiles || profiles.length === 0) {
    await sendWhatsAppMessage(
      phoneRaw,
      "Ola! Sou a ANA, assistente financeira do Cofre do Casal.\n\nEste numero ainda nao esta vinculado a nenhuma conta. Acesse o app e va em Perfil para cadastrar seu WhatsApp."
    );
    return new Response("OK", { status: 200 });
  }

  const user = profiles[0] as { id: string; couple_id: string; name: string };

  if (!user.couple_id) {
    await sendWhatsAppMessage(phoneRaw, "Ola, " + user.name + "! Sou a ANA. Sua conta ainda nao esta vinculada a um casal. Acesse o app para concluir a configuracao.");
    return new Response("OK", { status: 200 });
  }

  // Busca categorias do casal
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("couple_id", user.couple_id);

  if (!categories || categories.length === 0) {
    await sendWhatsAppMessage(phoneRaw, "Ola, " + user.name + "! Sou a ANA. Nao encontrei categorias cadastradas. Acesse o app e crie suas categorias primeiro.");
    return new Response("OK", { status: 200 });
  }

  // Interpreta a mensagem com Gemini
  const parsed = await parseMessageWithGemini(text, categories);

  if (!parsed) {
    await sendWhatsAppMessage(
      phoneRaw,
      "Ola, " + user.name + "! Sou a ANA, sua assistente financeira. Nao identifiquei uma transacao na sua mensagem.\n\nVoce pode me enviar assim:\n- gastei 45,90 no mercado\n- recebi salario de 3.200,00\n- paguei 189,50 de conta de luz\n\nEstou aqui para ajudar com todos os detalhes!"
    );
    return new Response("OK", { status: 200 });
  }

  // Encontra a categoria correspondente
  const category = categories.find(
    (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
  ) ?? categories.find((c) => c.type === parsed.type);

  if (!category) {
    await sendWhatsAppMessage(phoneRaw, "Ola, " + user.name + "! Sou a ANA. Nao encontrei a categoria \"" + parsed.category + "\" no seu cadastro. Verifique as categorias disponiveis no app.");
    return new Response("OK", { status: 200 });
  }

  // Busca primeira conta do casal
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("couple_id", user.couple_id)
    .limit(1);

  const accountId = accounts?.[0]?.id ?? null;

  // Insere transação
  const isoDate = new Date().toISOString();
  const { error } = await supabase.from("transactions").insert({
    couple_id: user.couple_id,
    member_id: user.id,
    description: parsed.description,
    amount: parsed.amount,
    date: isoDate,
    type: parsed.type,
    category_id: category.id,
    account_id: accountId,
    status: "pago",
  });

  if (error) {
    console.error("Erro ao inserir transacao:", error);
    await sendWhatsAppMessage(phoneRaw, "Desculpe, " + user.name + "! Tive um problema ao registrar sua transacao. Por favor, tente novamente em instantes.");
    return new Response("OK", { status: 200 });
  }

  // Resposta de confirmação com personalidade da ANA
  const tipo = parsed.type === "income" ? "Receita" : "Despesa";
  const valor = parsed.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  await sendWhatsAppMessage(
    phoneRaw,
    "Lancamento registrado com sucesso, " + user.name + "!\n\n" +
    "Tipo: " + tipo + "\n" +
    "Descricao: " + parsed.description + "\n" +
    "Valor: " + valor + "\n" +
    "Categoria: " + category.name + "\n" +
    "Data: " + dataHoje + "\n\n" +
    "Tudo anotado no Cofre do Casal! Se precisar corrigir algo, acesse o app. Estou sempre aqui!"
  );

  return new Response("OK", { status: 200 });
});
