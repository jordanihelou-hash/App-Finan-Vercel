/**
 * Store — Firebase-backed global state for the Couple Finance app.
 * Uses Firebase Auth (onAuthStateChanged) and Firestore (onSnapshot) for
 * real-time sync between partners. All writes go directly to Firestore.
 *
 * The StoreProvider lives inside the _app layout (client-only); Firebase is
 * never initialized on the SSR pass (guards via typeof window + useEffect).
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
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  getDoc,
} from "firebase/firestore";

import {
  onAuthChange,
  getOrCreateUserProfile,
  createCouple,
  signOut,
  getFirebaseDb,
  type UserProfile,
} from "./firebase";

import type {
  Account,
  Category,
  Transaction,
  Investment,
  InvestmentMove,
  Member,
} from "./mock-data";

// ── State ─────────────────────────────────────────────────────────────────────

/** 'loading' = waiting for Firebase Auth to resolve (initial paint)
 *  'authenticated' = user is logged in and couple data is subscribed
 *  'unauthenticated' = no user — AuthGuard will redirect to /login */
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
  transferBetween: (fromId: string, toId: string, amount: number) => void;
  addInvestmentMove: (
    investmentId: string,
    move: { kind: "aporte" | "resgate"; amount: number }
  ) => void;
  /** @deprecated Firebase Auth handles login; kept for interface compatibility */
  login: (email: string) => void;
  logout: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  // Keep refs to Firestore unsubscribe functions so we can tear them down
  const unsubs = useRef<Array<() => void>>([]);

  function clearSubscriptions() {
    unsubs.current.forEach((fn) => fn());
    unsubs.current = [];
  }

  useEffect(() => {
    // Guard: Firebase must only run in the browser
    if (typeof window === "undefined") return;

    const unsubAuth = onAuthChange(async (user) => {
      if (!user) {
        clearSubscriptions();
        setState({ ...initialState, authState: "unauthenticated" });
        return;
      }

      setState((s) => ({ ...s, authState: "loading", dataLoading: true, error: null }));

      try {
        // Fetch (or create) user profile
        let profile: UserProfile = await getOrCreateUserProfile(user);

        // Auto-create couple if user has none yet
        if (!profile.coupleId) {
          const coupleId = await createCouple(user.uid);
          profile = { ...profile, coupleId };
        }

        const coupleId = profile.coupleId!;
        const db = getFirebaseDb();

        // ── Subscribe: couple document (code + member list) ──────────────────
        const unsubCouple = onSnapshot(
          doc(db, "couples", coupleId),
          async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            const memberIds: string[] = data.memberIds ?? [];

            // Resolve member profiles from Firestore
            const resolved = await Promise.all(
              memberIds.map(async (uid) => {
                const profileSnap = await getDoc(
                  doc(db, "userProfiles", uid)
                );
                if (!profileSnap.exists()) return null;
                const p = profileSnap.data() as UserProfile;
                return {
                  id: uid,
                  name: p.name,
                  avatarColor: p.avatarColor,
                  initial: p.initial,
                } satisfies Member;
              })
            );

            const members = resolved.filter(Boolean) as Member[];
            setState((s) => ({
              ...s,
              coupleCode: data.code ?? "",
              partnerLinked: memberIds.length >= 2,
              members,
            }));
          }
        );
        unsubs.current.push(unsubCouple);

        // ── Subscribe: categories ────────────────────────────────────────────
        const unsubCats = onSnapshot(
          collection(db, "couples", coupleId, "categories"),
          (snap) => {
            const categories = snap.docs.map(
              (d) => ({ id: d.id, ...d.data() } as Category)
            );
            setState((s) => ({ ...s, categories }));
          }
        );
        unsubs.current.push(unsubCats);

        // ── Subscribe: accounts ──────────────────────────────────────────────
        const unsubAccounts = onSnapshot(
          collection(db, "couples", coupleId, "accounts"),
          (snap) => {
            const accounts = snap.docs.map(
              (d) => ({ id: d.id, ...d.data() } as Account)
            );
            setState((s) => ({ ...s, accounts }));
          }
        );
        unsubs.current.push(unsubAccounts);

        // ── Subscribe: transactions (sorted newest first) ────────────────────
        const unsubTx = onSnapshot(
          collection(db, "couples", coupleId, "transactions"),
          (snap) => {
            const transactions = snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Transaction))
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              );
            setState((s) => ({ ...s, transactions }));
          }
        );
        unsubs.current.push(unsubTx);

        // ── Subscribe: investments ───────────────────────────────────────────
        const unsubInv = onSnapshot(
          collection(db, "couples", coupleId, "investments"),
          (snap) => {
            const investments = snap.docs.map(
              (d) => ({ id: d.id, ...d.data() } as Investment)
            );
            setState((s) => ({ ...s, investments }));
          }
        );
        unsubs.current.push(unsubInv);

        setState((s) => ({
          ...s,
          authedEmail: user.email,
          coupleId,
          authState: "authenticated",
          dataLoading: false,
        }));
      } catch (err: unknown) {
        console.error("StoreProvider: failed to load couple data", err);
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar dados. Tente novamente.";
        setState((s) => ({
          ...s,
          authState: "authenticated", // still logged in
          dataLoading: false,
          error: message,
        }));
      }
    });

    return () => {
      unsubAuth();
      clearSubscriptions();
    };
  }, []);

  // ── Memoised API ─────────────────────────────────────────────────────────────
  const api = useMemo<StoreApi>(
    () => ({
      state,

      addTransaction: async (tx) => {
        if (!state.coupleId) return;
        const db = getFirebaseDb();

        // Write transaction
        await addDoc(
          collection(db, "couples", state.coupleId, "transactions"),
          { ...tx, createdAt: serverTimestamp() }
        );

        // Update account balance
        const account = state.accounts.find((a) => a.id === tx.accountId);
        if (account) {
          const delta = tx.type === "income" ? tx.amount : -tx.amount;
          await updateDoc(
            doc(db, "couples", state.coupleId, "accounts", tx.accountId),
            { balance: account.balance + delta }
          );
        }
      },

      addCategory: async (c) => {
        if (!state.coupleId) return;
        const db = getFirebaseDb();
        await addDoc(
          collection(db, "couples", state.coupleId, "categories"),
          c
        );
      },

      transferBetween: async (fromId, toId, amount) => {
        if (!state.coupleId) return;
        const db = getFirebaseDb();
        const from = state.accounts.find((a) => a.id === fromId);
        const to = state.accounts.find((a) => a.id === toId);
        if (!from || !to) return;
        await updateDoc(
          doc(db, "couples", state.coupleId, "accounts", fromId),
          { balance: from.balance - amount }
        );
        await updateDoc(
          doc(db, "couples", state.coupleId, "accounts", toId),
          { balance: to.balance + amount }
        );
      },

      addInvestmentMove: async (investmentId, move) => {
        if (!state.coupleId) return;
        const db = getFirebaseDb();
        const inv = state.investments.find((i) => i.id === investmentId);
        if (!inv) return;
        const newMove: InvestmentMove = {
          id: `mv_${Date.now()}`,
          date: new Date().toISOString(),
          ...move,
        };
        const newApplied =
          move.kind === "aporte"
            ? inv.applied + move.amount
            : Math.max(0, inv.applied - move.amount);
        await updateDoc(
          doc(db, "couples", state.coupleId, "investments", investmentId),
          { applied: newApplied, moves: arrayUnion(newMove) }
        );
      },

      login: (_email) => {
        // No-op: auth is fully handled by Firebase onAuthStateChanged above
      },

      logout: () => {
        signOut();
      },
    }),
    [state]
  );

  return (
    <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
