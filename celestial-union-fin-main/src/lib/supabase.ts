/**
 * Supabase — Auth + Database para o Cofre do Casal
 * Módulo client-side: nunca chamar fora de useEffect ou event handlers.
 *
 * Substitui firebase.ts — usa Google OAuth via redirect (não popup).
 */

import { createClient } from "@supabase/supabase-js";

// ── Client singleton ──────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos. " +
      "Crie um arquivo .env.local com as variáveis do seu projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    detectSessionInUrl: true,   // troca automaticamente o ?code= após OAuth
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Inicia o fluxo OAuth com o Google via redirect.
 * Se houver um código de casal pendente (modo "Vincular"), salva no sessionStorage.
 */
export async function signInWithGoogle(joinCode?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (joinCode?.trim()) {
    sessionStorage.setItem("pending_join_code", joinCode.trim().toUpperCase());
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── User profile ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "from-violet-400 to-fuchsia-500",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  couple_id: string | null;
  avatar_color: string;
  initial: string;
}

/**
 * Busca ou cria o perfil do usuário autenticado em user_profiles.
 * Usa upsert com ignoreDuplicates para ser seguro contra race conditions.
 */
export async function getOrCreateUserProfile(
  userId: string,
  email: string,
  displayName: string | null
): Promise<UserProfile> {
  const name = displayName ?? email.split("@")[0] ?? "Usuário";
  const draft = {
    id: userId,
    name,
    email,
    couple_id: null as string | null,
    avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    initial: name[0].toUpperCase(),
  };

  // Upsert: insere se não existir, ignora se já existir (onConflict = id)
  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(draft, { onConflict: "id", ignoreDuplicates: true });

  if (upsertError) throw upsertError;

  // Busca o perfil real (pode já existir com couple_id preenchido)
  const { data, error: fetchError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (fetchError) throw fetchError;
  return data as UserProfile;
}

// ── Default categories ────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Salário",      type: "income",  color: "emerald" },
  { name: "Freelance",    type: "income",  color: "emerald" },
  { name: "Dividendos",   type: "income",  color: "cyan"    },
  { name: "Moradia",      type: "expense", color: "violet"  },
  { name: "Alimentação",  type: "expense", color: "amber"   },
  { name: "Transporte",   type: "expense", color: "coral"   },
  { name: "Lazer",        type: "expense", color: "coral"   },
  { name: "Assinaturas",  type: "expense", color: "violet"  },
  { name: "Mercado",      type: "expense", color: "amber"   },
] as const;

// ── Couple management ─────────────────────────────────────────────────────────

function generateCoupleCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "JOIN-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Cria um novo casal, semeia as categorias padrão e vincula o usuário.
 * Retorna o coupleId gerado.
 */
export async function createCouple(userId: string): Promise<string> {
  // Gera código único
  let code = generateCoupleCode();
  const { data: existing } = await supabase
    .from("couples")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) code = generateCoupleCode(); // retry se já existir

  // Gera UUID no cliente para evitar precisar de SELECT após INSERT
  // (o SELECT falharia com 403 pois get_my_couple_id() ainda é null neste momento)
  const coupleId: string = crypto.randomUUID();

  const { error: coupleError } = await supabase
    .from("couples")
    .insert({ id: coupleId, code });
  if (coupleError) throw coupleError;

  // Adiciona o usuário como membro
  const { error: memberError } = await supabase
    .from("couple_members")
    .insert({ couple_id: coupleId, user_id: userId });
  if (memberError) throw memberError;

  // Vincula o perfil ao casal ANTES de inserir categorias
  // (necessário para get_my_couple_id() retornar o coupleId correto no RLS)
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ couple_id: coupleId })
    .eq("id", userId);
  if (profileError) throw profileError;

  // Semeia categorias padrão (agora get_my_couple_id() já retorna o coupleId)
  const categories = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    couple_id: coupleId,
  }));
  const { error: catError } = await supabase
    .from("categories")
    .insert(categories);
  if (catError) throw catError;

  return coupleId;
}

/**
 * Vincula o usuário logado a um casal existente pelo código de convite.
 *
 * Usa a RPC `join_couple_by_code` (security definer) para bypasser o RLS,
 * que bloquearia a query direta na tabela `couples` — um usuário só consegue
 * ver o próprio casal pela policy padrão, então buscar pelo código de outro
 * casal retornaria null sem a RPC.
 *
 * Retorna o coupleId ou null se o código não existir.
 * O parâmetro `userId` é mantido por compatibilidade de interface — a função
 * SQL usa auth.uid() internamente.
 */
export async function joinCoupleByCode(
  _userId: string,
  code: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("join_couple_by_code", {
    invite_code: code,
  });

  if (error) {
    console.error("[supabase] join_couple_by_code RPC error:", error);
    throw error;
  }

  // RPC retorna uuid ou null
  return (data as string | null) ?? null;
}
