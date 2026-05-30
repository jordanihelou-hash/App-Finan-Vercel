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
  Investment,
  InvestmentMove,
  Member,
} from "./mock-data";

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
  addCategory: (c: Omit<Category, "id">) => void;
  addAccount: (a: Omit<Account, "id">) => void;
  addInvestment: (inv: Omit<Investment, "id" | "moves">) => void;
  transferBetween: (fromId: string, toId: string, amount: number) => void;
  addInvestmentMove: (
    investmentId: string,
    move: { kind: "aporte" | "resgate"; amount: number }
  ) => void;
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

        if (pendingCode && !profile.couple_id) {
          // Tenta vincular ao casal do parceiro
          const joined = await joinCoupleByCode(user.id, pendingCode);
          if (joined) {
            profile = { ...profile, couple_id: joined };
          } else {
            // Código inválido → cria casal próprio
            console.warn("[Store] Código de convite inválido:", pendingCode);
            const coupleId = await createCouple(user.id);
            profile = { ...profile, couple_id: coupleId };
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
        });
        if (error) {
          console.error("[Store] addTransaction:", error);
          return;
        }

        // Atualiza saldo da conta
        const account = state.accounts.find((a) => a.id === tx.accountId);
        if (account) {
          const delta = tx.type === "income" ? tx.amount : -tx.amount;
          await supabase
            .from("accounts")
            .update({ balance: account.balance + delta })
            .eq("id", tx.accountId);
        }
      },

      addCategory: async (c) => {
        if (!state.coupleId) return;
        const { error } = await supabase.from("categories").insert({
          couple_id: state.coupleId,
          name: c.name,
          type: c.type,
          color: c.color,
        });
        if (error) console.error("[Store] addCategory:", error);
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
        if (error) console.error("[Store] addAccount:", error);
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
        });
        if (error) console.error("[Store] addInvestment:", error);
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
