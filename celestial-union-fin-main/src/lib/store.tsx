/**
 * Store — Supabase-backed global state for the Cofre do Casal app.
 *
 * Substitui a implementação Firebase/Firestore.
 * Usa supabase.auth.onAuthStateChange para sessão e
 * supabase.channel() para sync em tempo real entre parceiros.
 *
 * O StoreProvider vive dentro do layout _app (client-only).
 * Supabase nunca é inicializado no SSR (guard via typeof window + useEffect).
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  supabase,
  getOrCreateUserProfile,
  createCouple,
  joinCoupleByCode,
  signOut,
  type UserProfile,
} from "./supabase";

import type {
  Account,
  Category,
  Transaction,
  TxStatus,
  Investment,
  InvestmentMove,
  InvestmentGoal,
  Member,
} from "./mock-data";
import { INVESTMENT_GOALS as DEFAULT_GOALS } from "./mock-data";

// ── Type helpers (DB snake_case → TS camelCase) ───────────────────────────────

function dbToAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Account["type"],
    balance: row.balance as number,
    memberId: row.member_id as string,
    brand: row.brand as string | undefined,
  };
}

function dbToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    description: row.description as string,
    amount: row.amount as number,
    date: row.date as string,
    type: row.type as Transaction["type"],
    categoryId: row.category_id as string,
    memberId: row.member_id as string,
    accountId: row.account_id as string,
    status: (row.status as TxStatus | undefined) ?? "pago",
  };
}

function dbToInvestment(row: Record<string, unknown>): Investment {
  const moves = (row.investment_moves as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: row.id as string,
    name: row.name as string,
    ticker: row.ticker as string | undefined,
    type: row.type as Investment["type"],
    applied: row.applied as number,
    projectedYield: row.projected_yield as number,
    goalId: row.goal_id as string | undefined,
    moves: moves.map(
      (m): InvestmentMove => ({
        id: m.id as string,
        kind: m.kind as InvestmentMove["kind"],
        amount: m.amount as number,
        date: m.date as string,
      })
    ),
  };
}

// ── State ─────────────────────────────────────────────────────────────────────

/** 'loading'         → aguardando Supabase Auth resolver (primeiro render)
 *  'authenticated'   → usuário logado, dados do casal carregados
 *  'unauthenticated' → sem sessão — AuthGuard redirecionará para /login */
export type AuthState = "loading" | "authenticated" | "unauthenticated";

interface State {
  members: Member[];
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  investments: Investment[];
  /** Metas de investimento do casal (locais + persistidas) */
  investmentGoals: InvestmentGoal[];
  coupleCode: string;
  partnerLinked: boolean;
  authedEmail: string | null;
  currentUserId: string | null;
  coupleId: string | null;
  authState: AuthState;
  dataLoading: boolean;
  error: string | null;
}

const initialState: State = {
  members: [],
  categories: [],
  accounts: [],
  transactions: [],
  investments: [],
  investmentGoals: DEFAULT_GOALS,
  coupleCode: "",
  partnerLinked: false,
  authedEmail: null,
  currentUserId: null,
  coupleId: null,
  authState: "loading",
  dataLoading: false,
  error: null,
};

// ── API interface ─────────────────────────────────────────────────────────────

interface StoreApi {
  state: State;
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  deleteTransaction: (id: string) => Promise<void>;
  /** Altera o status de uma transação (previsto → pago ou vice-versa) */
  updateTransactionStatus: (id: string, status: TxStatus) => Promise<void>;
  /** Adiciona uma nova meta de investimento */
  addInvestmentGoal: (goal: Omit<InvestmentGoal, "id">) => string;
  /** Retorna o ID da nova categoria criada, ou null em caso de erro */
  addCategory: (c: Omit<Category, "id">) => Promise<string | null>;
  /** Atualiza nome, cor, grupo e orçamento de uma categoria existente */
  updateCategory: (id: string, changes: Partial<Omit<Category, "id">>) => Promise<void>;
  /** Remove uma categoria. Retorna false se há transações vinculadas. */
  deleteCategory: (id: string) => Promise<boolean>;
  addAccount: (a: Omit<Account, "id">) => void;
  addInvestment: (inv: Omit<Investment, "id" | "moves">) => void;
  deleteInvestment: (id: string) => Promise<void>;
  transferBetween: (fromId: string, toId: string, amount: number) => void;
  addInvestmentMove: (
    investmentId: string,
    move: { kind: "aporte" | "resgate"; amount: number }
  ) => void;
  regenerateCode: () => void;
  /** Vincula o usuário logado a um casal pelo código de convite. Retorna true se bem-sucedido. */
  joinCouple: (code: string) => Promise<boolean>;
  /** @deprecated mantido por compatibilidade de interface */
  login: (email: string) => void;
  logout: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const dataLoadedRef = useRef(false);

  function clearSubscriptions() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  // Helpers para refetch de uma coleção específica
  const refetchAccounts = (coupleId: string) =>
    supabase
      .from("accounts")
      .select("*")
      .eq("couple_id", coupleId)
      .then(({ data }) => {
        if (data) setState((s) => ({ ...s, accounts: data.map(dbToAccount) }));
      });

  const refetchTransactions = (coupleId: string) =>
    supabase
      .from("transactions")
      .select("*")
      .eq("couple_id", coupleId)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data)
          setState((s) => ({ ...s, transactions: data.map(dbToTransaction) }));
      });

  const refetchCategories = (coupleId: string) =>
    supabase
      .from("categories")
      .select("*")
      .eq("couple_id", coupleId)
      .then(({ data }) => {
        if (data)
          setState((s) => ({ ...s, categories: data as Category[] }));
      });

  const refetchInvestments = (coupleId: string) =>
    supabase
      .from("investments")
      .select("*, investment_moves(*)")
      .eq("couple_id", coupleId)
      .then(({ data }) => {
        if (data)
          setState((s) => ({
            ...s,
            investments: data.map((r) =>
              dbToInvestment(r as unknown as Record<string, unknown>)
            ),
          }));
      });

  const refetchMembers = async (coupleId: string) => {
    // Step 1: get user_ids from couple_members
    const { data: cmData } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", coupleId);
    if (!cmData || cmData.length === 0) return;

    // Step 2: fetch profiles for those user_ids
    const ids = cmData.map((r) => r.user_id as string);
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, name, avatar_color, initial")
      .in("id", ids);
    if (!profiles) return;

    const members: Member[] = profiles.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      avatarColor: p.avatar_color as string,
      initial: p.initial as string,
    }));
    setState((s) => ({ ...s, members, partnerLinked: members.length >= 2 }));
  };

  useEffect(() => {
    // Guard: Supabase Auth só funciona no browser
    if (typeof window === "undefined") return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED: pula se já carregamos os dados (evita reload desnecessário)
      // mas deixa passar se ainda não carregamos (token refresh pode ser o 1º evento)
      if (event === "TOKEN_REFRESHED" && dataLoadedRef.current) return;

      if (!session) {
        // Se há tokens OAuth no URL (retorno do Google), o SDK ainda está
        // processando o code exchange — aguarda o SIGNED_IN antes de decidir.
        if (typeof window !== "undefined") {
          const h = window.location.hash;
          const q = window.location.search;
          if (h.includes("access_token=") || h.includes("refresh_token=") || q.includes("code=")) {
            return; // Aguarda o SIGNED_IN
          }
        }

        clearSubscriptions();
        setState({ ...initialState, authState: "unauthenticated" });
        return;
      }

      setState((s) => ({
        ...s,
        authState: "loading",
        dataLoading: true,
        error: null,
      }));

      try {
        const user = session.user;
        const displayName =
          (user.user_metadata?.full_name as string | null) ??
          (user.user_metadata?.name as string | null) ??
          null;

        // Busca (ou cria) perfil
        let profile = await getOrCreateUserProfile(
          user.id,
          user.email ?? "",
          displayName
        );

        // Verifica se há um código de casal pendente (fluxo "Vincular ao parceiro")
        const pendingCode =
          typeof window !== "undefined"
            ? sessionStorage.getItem("pending_join_code")
            : null;

        if (pendingCode) {
          // Tenta vincular ao casal do parceiro (funciona mesmo se já tiver couple_id próprio)
          const joined = await joinCoupleByCode(user.id, pendingCode);
          if (joined) {
            profile = { ...profile, couple_id: joined };
          } else if (!profile.couple_id) {
            // Código inválido e sem casal → cria casal próprio
            console.warn("[Store] Código de convite inválido:", pendingCode);
            const coupleId = await createCouple(user.id);
            profile = { ...profile, couple_id: coupleId };
          } else {
            console.warn("[Store] Código de convite inválido, mantendo casal existente:", pendingCode);
          }
          sessionStorage.removeItem("pending_join_code");
        } else if (!profile.couple_id) {
          // Novo usuário sem casal: cria automaticamente
          const coupleId = await createCouple(user.id);
          profile = { ...profile, couple_id: coupleId };
        }

        const coupleId = profile.couple_id!;

        // ── Carga inicial de todos os dados ────────────────────────────────
        const [
          coupleResult,
          memberIdsResult,
          categoriesResult,
          accountsResult,
          transactionsResult,
          investmentsResult,
        ] = await Promise.all([
          supabase.from("couples").select("code").eq("id", coupleId).single(),
          supabase
            .from("couple_members")
            .select("user_id")
            .eq("couple_id", coupleId),
          supabase.from("categories").select("*").eq("couple_id", coupleId),
          supabase.from("accounts").select("*").eq("couple_id", coupleId),
          supabase
            .from("transactions")
            .select("*")
            .eq("couple_id", coupleId)
            .order("date", { ascending: false }),
          supabase
            .from("investments")
            .select("*, investment_moves(*)")
            .eq("couple_id", coupleId),
        ]);

        const coupleCode = coupleResult.data?.code ?? "";

        // Fetch user profiles for all couple members
        const memberUserIds = (memberIdsResult.data ?? []).map((r) => r.user_id as string);
        let members: Member[] = [];
        if (memberUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("user_profiles")
            .select("id, name, avatar_color, initial")
            .in("id", memberUserIds);
          members = (profilesData ?? []).map((p) => ({
            id: p.id as string,
            name: p.name as string,
            avatarColor: p.avatar_color as string,
            initial: p.initial as string,
          }));
        }

        const categories = (categoriesResult.data ?? []) as Category[];

        const accounts = (accountsResult.data ?? []).map((r) =>
          dbToAccount(r as unknown as Record<string, unknown>)
        );

        const transactions = (transactionsResult.data ?? []).map((r) =>
          dbToTransaction(r as unknown as Record<string, unknown>)
        );

        const investments = (investmentsResult.data ?? []).map((r) =>
          dbToInvestment(r as unknown as Record<string, unknown>)
        );

        dataLoadedRef.current = true;
        setState((s) => ({
          ...s,
          coupleCode,
          coupleId,
          partnerLinked: members.length >= 2,
          members,
          categories,
          accounts,
          transactions,
          investments,
          authedEmail: user.email ?? null,
          currentUserId: user.id,
          authState: "authenticated",
          dataLoading: false,
        }));

        // ── Subscriptions Realtime ─────────────────────────────────────────
        clearSubscriptions();
        const channel = supabase
          .channel(`couple-${coupleId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "categories",
              filter: `couple_id=eq.${coupleId}`,
            },
            () => refetchCategories(coupleId)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "accounts",
              filter: `couple_id=eq.${coupleId}`,
            },
            () => refetchAccounts(coupleId)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "transactions",
              filter: `couple_id=eq.${coupleId}`,
            },
            () => refetchTransactions(coupleId)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "investments",
              filter: `couple_id=eq.${coupleId}`,
            },
            () => refetchInvestments(coupleId)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "investment_moves",
            },
            () => refetchInvestments(coupleId)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "couple_members",
              filter: `couple_id=eq.${coupleId}`,
            },
            () => refetchMembers(coupleId)
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err: unknown) {
        console.error("StoreProvider: falha ao carregar dados do casal", err);
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar dados. Tente novamente.";
        setState((s) => ({
          ...s,
          authState: "authenticated",
          dataLoading: false,
          error: message,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
      clearSubscriptions();
    };
  }, []);

  // Timeout de segurança: se auth não resolver em 90s, redireciona para login.
  // Supabase free tier pode levar 30-60s no cold start (primeira requisição após inatividade).
  // 90s garante que o cold start complete antes de forçar logout.
  useEffect(() => {
    const t = setTimeout(() => {
      setState((s) => {
        if (s.authState === "loading") {
          console.warn("[Store] Auth timeout — forçando unauthenticated");
          return { ...s, authState: "unauthenticated" };
        }
        return s;
      });
    }, 90_000);
    return () => clearTimeout(t);
  }, []);

  // ── Memoised API ──────────────────────────────────────────────────────────────
  const api = useMemo<StoreApi>(
    () => ({
      state,

      addTransaction: async (tx) => {
        if (!state.coupleId) return;

        // Insere a transação
        const { error } = await supabase.from("transactions").insert({
          couple_id: state.coupleId,
          description: tx.description,
          amount: tx.amount,
          date: tx.date,
          type: tx.type,
          category_id: tx.categoryId,
          member_id: tx.memberId,
          account_id: tx.accountId,
          status: tx.status ?? "pago",
        });
        if (error) {
          console.error("[Store] addTransaction:", error);
          return;
        }

        // Atualiza saldo da conta SOMENTE se status === "pago"
        // Transações "previsto" não afetam o saldo real
        const account = (tx.status ?? "pago") === "pago" && tx.accountId
          ? state.accounts.find((a) => a.id === tx.accountId)
          : null;
        if (account) {
          const delta = tx.type === "income" ? tx.amount : -tx.amount;
          await supabase
            .from("accounts")
            .update({ balance: account.balance + delta })
            .eq("id", tx.accountId);
        }

        // Refetch imediato — não espera Realtime
        await Promise.all([
          refetchTransactions(state.coupleId),
          refetchAccounts(state.coupleId),
        ]);
      },

      updateTransactionStatus: async (id: string, status: TxStatus) => {
        if (!state.coupleId) return;
        const tx = state.transactions.find((t) => t.id === id);
        if (!tx) return;

        // Atualização otimista local
        setState((s) => ({
          ...s,
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, status } : t
          ),
        }));

        // Ajusta saldo da conta quando status muda
        // previsto → pago: aplica o delta (a transação agora é real)
        // pago → previsto: reverte o delta (a transação volta a ser planejada)
        if (tx.accountId) {
          const account = state.accounts.find((a) => a.id === tx.accountId);
          if (account) {
            const sign = tx.type === "income" ? 1 : -1;
            const delta = status === "pago"
              ? sign * tx.amount      // confirmando: aplica
              : -sign * tx.amount;   // revertendo: remove
            await supabase
              .from("accounts")
              .update({ balance: account.balance + delta })
              .eq("id", tx.accountId);
          }
        }

        const { error } = await supabase
          .from("transactions")
          .update({ status })
          .eq("id", id);
        if (error) {
          console.error("[Store] updateTransactionStatus:", error);
          // Reverte em caso de erro
          await Promise.all([
            refetchTransactions(state.coupleId),
            refetchAccounts(state.coupleId),
          ]);
        } else {
          await refetchAccounts(state.coupleId);
        }
      },

      deleteTransaction: async (id: string) => {
        if (!state.coupleId) return;
        // Restaura saldo da conta antes de deletar — SOMENTE se status === "pago"
        // Transações "previsto" nunca afetaram o saldo, então não há nada a reverter
        const tx = state.transactions.find((t) => t.id === id);
        if (tx?.accountId && (tx.status ?? "pago") === "pago") {
          const account = state.accounts.find((a) => a.id === tx.accountId);
          if (account) {
            const delta = tx.type === "income" ? -tx.amount : tx.amount;
            await supabase
              .from("accounts")
              .update({ balance: account.balance + delta })
              .eq("id", tx.accountId);
          }
        }
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) {
          console.error("[Store] deleteTransaction:", error);
          return;
        }
        await Promise.all([
          refetchTransactions(state.coupleId),
          refetchAccounts(state.coupleId),
        ]);
      },

      addCategory: async (c): Promise<string | null> => {
        if (!state.coupleId) return null;
        const { data, error } = await supabase
          .from("categories")
          .insert({
            couple_id: state.coupleId,
            name: c.name,
            type: c.type,
            color: c.color,
            group: c.group ?? null,
            budget: c.budget ?? null,
          })
          .select("id")
          .single();
        if (error) {
          console.error("[Store] addCategory:", error);
          return null;
        }
        await refetchCategories(state.coupleId);
        return (data?.id as string) ?? null;
      },

      deleteCategory: async (id: string): Promise<boolean> => {
        if (!state.coupleId) return false;
        const inUse = state.transactions.some((t) => t.categoryId === id);
        if (inUse) return false;
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) {
          console.error("[Store] deleteCategory:", error);
          return false;
        }
        await refetchCategories(state.coupleId);
        return true;
      },

      updateCategory: async (id, changes) => {
        if (!state.coupleId) return;
        // Optimistic update
        setState((s) => ({
          ...s,
          categories: s.categories.map((c) => c.id === id ? { ...c, ...changes } : c),
        }));
        const { error } = await supabase
          .from("categories")
          .update({
            ...(changes.name !== undefined && { name: changes.name }),
            ...(changes.type !== undefined && { type: changes.type }),
            ...(changes.color !== undefined && { color: changes.color }),
            ...(changes.group !== undefined && { group: changes.group }),
            ...(changes.budget !== undefined && { budget: changes.budget }),
          })
          .eq("id", id);
        if (error) {
          console.error("[Store] updateCategory:", error);
          await refetchCategories(state.coupleId);
        }
      },

      addAccount: async (a) => {
        if (!state.coupleId) return;
        const { error } = await supabase.from("accounts").insert({
          couple_id: state.coupleId,
          name: a.name,
          type: a.type,
          balance: a.balance ?? 0,
          member_id: a.memberId,
          brand: a.brand ?? null,
        });
        if (error) {
          console.error("[Store] addAccount:", error);
          return;
        }
        await refetchAccounts(state.coupleId);
      },

      addInvestment: async (inv) => {
        if (!state.coupleId) return;
        const { error } = await supabase.from("investments").insert({
          couple_id: state.coupleId,
          name: inv.name,
          ticker: inv.ticker ?? null,
          type: inv.type,
          applied: inv.applied ?? 0,
          projected_yield: inv.projectedYield ?? 0,
          goal_id: inv.goalId ?? null,
        });
        if (error) {
          console.error("[Store] addInvestment:", error);
          return;
        }
        await refetchInvestments(state.coupleId);
      },

      deleteInvestment: async (id: string) => {
        if (!state.coupleId) return;
        // Remove movimentos primeiro (FK constraint)
        await supabase.from("investment_moves").delete().eq("investment_id", id);
        const { error } = await supabase.from("investments").delete().eq("id", id);
        if (error) {
          console.error("[Store] deleteInvestment:", error);
          return;
        }
        await refetchInvestments(state.coupleId);
      },

      transferBetween: async (fromId, toId, amount) => {
        if (!state.coupleId) return;
        const from = state.accounts.find((a) => a.id === fromId);
        const to = state.accounts.find((a) => a.id === toId);
        if (!from || !to) return;

        await Promise.all([
          supabase
            .from("accounts")
            .update({ balance: from.balance - amount })
            .eq("id", fromId),
          supabase
            .from("accounts")
            .update({ balance: to.balance + amount })
            .eq("id", toId),
        ]);
      },

      addInvestmentMove: async (investmentId, move) => {
        if (!state.coupleId) return;
        const inv = state.investments.find((i) => i.id === investmentId);
        if (!inv) return;

        const newApplied =
          move.kind === "aporte"
            ? inv.applied + move.amount
            : Math.max(0, inv.applied - move.amount);

        await Promise.all([
          supabase.from("investment_moves").insert({
            investment_id: investmentId,
            kind: move.kind,
            amount: move.amount,
            date: new Date().toISOString(),
          }),
          supabase
            .from("investments")
            .update({ applied: newApplied })
            .eq("id", investmentId),
        ]);
        await refetchInvestments(state.coupleId);
      },

      joinCouple: async (code: string): Promise<boolean> => {
        if (!state.currentUserId) return false;
        try {
          const joined = await joinCoupleByCode(state.currentUserId, code);
          if (!joined) return false;
          // Recarrega os membros do novo casal
          const { data: cmData } = await supabase
            .from("couple_members")
            .select("user_id")
            .eq("couple_id", joined);
          const ids = (cmData ?? []).map((r) => r.user_id as string);
          const { data: profilesData } = await supabase
            .from("user_profiles")
            .select("id, name, avatar_color, initial")
            .in("id", ids);
          const members: Member[] = (profilesData ?? []).map((p) => ({
            id: p.id as string,
            name: p.name as string,
            avatarColor: p.avatar_color as string,
            initial: p.initial as string,
          }));
          const { data: coupleRow } = await supabase
            .from("couples")
            .select("code")
            .eq("id", joined)
            .single();
          setState((s) => ({
            ...s,
            coupleId: joined,
            coupleCode: coupleRow?.code ?? s.coupleCode,
            members,
            partnerLinked: members.length >= 2,
          }));
          return true;
        } catch (err) {
          console.error("[Store] joinCouple:", err);
          return false;
        }
      },

      regenerateCode: async () => {
        if (!state.coupleId) return;
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "JOIN-";
        for (let i = 0; i < 4; i++)
          code += chars[Math.floor(Math.random() * chars.length)];
        const { error } = await supabase
          .from("couples")
          .update({ code })
          .eq("id", state.coupleId);
        if (!error) setState((s) => ({ ...s, coupleCode: code }));
        else console.error("[Store] regenerateCode:", error);
      },

      addInvestmentGoal: (goal: Omit<InvestmentGoal, "id">) => {
        const id = `goal_${Date.now()}`;
        const newGoal: InvestmentGoal = { ...goal, id };
        setState((s) => ({ ...s, investmentGoals: [...s.investmentGoals, newGoal] }));
        return id;
      },

      login: (_email) => {
        // No-op: auth é gerenciado pelo Supabase onAuthStateChange
      },

      logout: () => {
        signOut();
      },
    }),
    [state]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de <StoreProvider>");
  return ctx;
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
