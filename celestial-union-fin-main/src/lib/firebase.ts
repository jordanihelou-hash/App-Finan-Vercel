/**
 * Firebase — Auth + Firestore para o Gestor Financeiro do Casal
 * Módulo client-side: nunca chamar fora de useEffect ou event handlers.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

// ── Config ────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  projectId: "gen-lang-client-0087617729",
  appId: "1:42254868422:web:27708fda0598e836dadcc7",
  apiKey: "AIzaSyCjgvHNLa3af5PhxAYlPM2O86kni6hDZS8",
  authDomain: "gen-lang-client-0087617729.firebaseapp.com",
  storageBucket: "gen-lang-client-0087617729.firebasestorage.app",
  messagingSenderId: "42254868422",
};

// ── Lazy singletons (only safe to call client-side) ───────────────────────────

function getFirebaseApp() {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

// Named Firestore database (AI Studio uses a non-default database)
const FIRESTORE_DB_ID = "ai-studio-251a198c-7f27-4d7d-aba5-0a6d2e8f4ab2";

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp(), FIRESTORE_DB_ID);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function onAuthChange(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(getFirebaseAuth(), provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getFirebaseAuth());
}

// ── User profile ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "from-violet-400 to-fuchsia-500",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
];

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  coupleId: string | null;
  avatarColor: string;
  initial: string;
}

export async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
  const db = getFirebaseDb();
  const ref = doc(db, "userProfiles", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const name =
    user.displayName ?? user.email?.split("@")[0] ?? "Usuário";
  const profile: UserProfile = {
    uid: user.uid,
    name,
    email: user.email ?? "",
    coupleId: null,
    avatarColor:
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    initial: name[0].toUpperCase(),
  };

  await setDoc(ref, profile);
  return profile;
}

// ── Default categories ────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Salário", type: "income", color: "emerald" },
  { name: "Freelance", type: "income", color: "emerald" },
  { name: "Dividendos", type: "income", color: "cyan" },
  { name: "Moradia", type: "expense", color: "violet" },
  { name: "Alimentação", type: "expense", color: "amber" },
  { name: "Transporte", type: "expense", color: "coral" },
  { name: "Lazer", type: "expense", color: "coral" },
  { name: "Assinaturas", type: "expense", color: "violet" },
  { name: "Mercado", type: "expense", color: "amber" },
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
 * Creates a new couple document, seeds default categories, updates userProfile.
 * Returns the new coupleId.
 */
export async function createCouple(userId: string): Promise<string> {
  const db = getFirebaseDb();

  // Ensure unique code
  let code = generateCoupleCode();
  const existing = await getDocs(
    query(collection(db, "couples"), where("code", "==", code))
  );
  if (!existing.empty) code = generateCoupleCode();

  const coupleRef = doc(collection(db, "couples"));
  await setDoc(coupleRef, {
    code,
    memberIds: [userId],
    createdAt: serverTimestamp(),
  });

  // Seed default categories
  for (const cat of DEFAULT_CATEGORIES) {
    await addDoc(
      collection(db, "couples", coupleRef.id, "categories"),
      cat
    );
  }

  // Link user profile to couple
  await updateDoc(doc(db, "userProfiles", userId), {
    coupleId: coupleRef.id,
  });

  return coupleRef.id;
}

/**
 * Joins an existing couple by code. Returns coupleId or null if code not found.
 */
export async function joinCoupleByCode(
  userId: string,
  code: string
): Promise<string | null> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "couples"),
    where("code", "==", code.toUpperCase().trim())
  );
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const coupleId = snap.docs[0].id;

  await updateDoc(doc(db, "couples", coupleId), {
    memberIds: arrayUnion(userId),
  });

  await updateDoc(doc(db, "userProfiles", userId), { coupleId });

  return coupleId;
}
