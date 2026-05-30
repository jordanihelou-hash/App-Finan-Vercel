/**
 * UserProfileModal — exibido após o primeiro login para o usuário
 * preencher informações básicas. Também acessível via "Gerenciar" na aba Casal.
 *
 * Campos armazenados em user_profiles: name, initial.
 * Para adicionar phone/birth_date, inclua essas colunas na tabela user_profiles.
 */

import { useState } from "react";
import { X, User, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  userId: string;
  currentName: string;
  onClose: () => void;
  onSaved?: (name: string) => void;
}

export function UserProfileModal({ userId, currentName, onClose, onSaved }: Props) {
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(() => localStorage.getItem(`profile_phone_${userId}`) ?? "");
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem(`profile_birth_${userId}`) ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Por favor, insira seu nome.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const trimmedName = name.trim();
      const initial = trimmedName[0].toUpperCase();

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ name: trimmedName, initial })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Armazena campos extras localmente (adicione colunas no Supabase para persistência total)
      if (phone.trim()) localStorage.setItem(`profile_phone_${userId}`, phone.trim());
      if (birthDate) localStorage.setItem(`profile_birth_${userId}`, birthDate);

      // Marca perfil como completo
      localStorage.setItem(`profile_complete_${userId}`, "1");

      setSaved(true);
      setTimeout(() => {
        onSaved?.(trimmedName);
        onClose();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar perfil.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md glass-card ring-1 ring-white/10 ring-inset-soft rounded-t-3xl sm:rounded-2xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl max-h-[90dvh] overflow-y-auto"
      >
        {/* Handle bar */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold">Meu Perfil</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Informações básicas da sua conta
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-white/5 grid place-items-center"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Avatar placeholder */}
        <div className="flex justify-center mb-5">
          <div className="size-16 rounded-2xl bg-primary/20 ring-1 ring-primary/40 grid place-items-center">
            <User className="size-7 text-primary" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
              Nome completo *
            </span>
            <input
              className="w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
              Telefone
            </span>
            <input
              className="w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50 transition-all"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              type="tel"
              inputMode="tel"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
              Data de nascimento
            </span>
            <input
              className="w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50 transition-all [color-scheme:dark]"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              type="date"
            />
          </label>

          {error && (
            <p className="text-xs text-coral p-3 bg-coral/10 ring-1 ring-coral/20 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || saved}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
          >
            {saved ? (
              <><Check className="size-4" /> Salvo!</>
            ) : loading ? (
              <><Loader2 className="size-4 animate-spin" /> Salvando…</>
            ) : (
              "Salvar Perfil"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Verifica se o perfil do usuário já foi preenchido */
export function isProfileComplete(userId: string): boolean {
  return localStorage.getItem(`profile_complete_${userId}`) === "1";
}
