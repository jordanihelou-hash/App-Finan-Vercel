import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore, formatBRL } from "@/lib/store";
import { ArrowRightLeft, Wallet, Plus } from "lucide-react";
import { Sheet } from "./_app.transactions";
import type { Account } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/accounts")({
  component: AccountsPage,
});

// Estilo de input/select com fundo explícito (evita branco-sobre-branco)
const inputCls = "w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50 transition-all text-foreground";

function AccountsPage() {
  const { state, transferBetween, addAccount } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const displayAccounts =
    view === "individual" && state.currentUserId
      ? state.accounts.filter((a) => a.memberId === state.currentUserId)
      : state.accounts;

  const total = displayAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <AppHeader
        view={view}
        onViewChange={setView}
        rightSlot={
          <div className="flex items-center gap-2">
            {state.accounts.length >= 2 && (
              <button
                onClick={() => setShowTransfer(true)}
                aria-label="Transferir"
                className="size-10 grid place-items-center bg-white/5 text-foreground rounded-xl ring-1 ring-white/10 active:scale-95 transition"
              >
                <ArrowRightLeft className="size-4" />
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              aria-label="Nova conta"
              className="size-10 grid place-items-center bg-primary text-primary-foreground rounded-xl ring-1 ring-primary shadow-[0_4px_14px_-2px_oklch(0.68_0.22_305/0.45)] active:scale-95 transition"
            >
              <Plus className="size-4" />
            </button>
          </div>
        }
      />

      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up relative overflow-hidden">
        <div className="absolute -top-16 -right-16 size-48 bg-primary/15 blur-[60px] rounded-full pointer-events-none" />
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Patrimônio em contas</p>
        <p className="mono text-3xl font-semibold mt-1">{formatBRL(total)}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{displayAccounts.length} conta{displayAccounts.length !== 1 ? "s" : ""} vinculada{displayAccounts.length !== 1 ? "s" : ""}</span>
          <span className="text-emerald">● Sincronizadas</span>
        </div>
      </div>

      {/* Empty state */}
      {displayAccounts.length === 0 && (
        <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-8 flex flex-col items-center gap-3 text-center animate-fade-up">
          <div className="size-14 rounded-2xl bg-primary/10 grid place-items-center">
            <Wallet className="size-7 text-primary" />
          </div>
          <p className="text-sm font-medium">Nenhuma conta cadastrada</p>
          <p className="text-xs text-muted-foreground">Adicione suas contas bancárias, carteiras digitais ou dinheiro em espécie.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl glow-violet"
          >
            + Adicionar primeira conta
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {displayAccounts.map((a, i) => {
          const member = state.members.find((m) => m.id === a.memberId);
          return (
            <div
              key={a.id}
              className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 animate-fade-up active:scale-[0.99] transition-transform"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
                  <Wallet className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">{a.type}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{a.brand ? `${a.brand} · ` : ""}{member?.name}</p>
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className="mono text-2xl font-semibold">{formatBRL(a.balance)}</p>
                <span className="text-[11px] text-emerald">● Ativa</span>
              </div>
            </div>
          );
        })}
      </div>

      {showTransfer && (
        <TransferModal
          onClose={() => setShowTransfer(false)}
          onTransfer={transferBetween}
        />
      )}
      {showAdd && (
        <AddAccountModal
          onClose={() => setShowAdd(false)}
          onSave={addAccount}
        />
      )}
    </>
  );
}

// ── Modal: Nova Conta ─────────────────────────────────────────────────────────

const ACCOUNT_TYPES: Account["type"][] = [
  "Conta Corrente",
  "Poupança",
  "Carteira Digital",
  "Dinheiro",
  "Investimentos",
];

function AddAccountModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: ReturnType<typeof useStore>["addAccount"];
}) {
  const { state } = useStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("Conta Corrente");
  const [balance, setBalance] = useState("0");
  const [brand, setBrand] = useState("");
  const [memberId, setMemberId] = useState(state.currentUserId ?? state.members[0]?.id ?? "");

  return (
    <Sheet onClose={onClose} title="Nova Conta">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const bal = parseFloat(balance.replace(",", ".")) || 0;
          onSave({
            name: name.trim(),
            type,
            balance: bal,
            memberId,
            brand: brand.trim() || undefined,
          });
          onClose();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Nome da conta *</span>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Nubank, Itaú Corrente…"
            required
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Tipo</span>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as Account["type"])}>
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Saldo atual (R$)</span>
          <input
            className={inputCls + " mono"}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Banco / Instituição</span>
          <input
            className={inputCls}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Ex: Nubank, Inter, XP…"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Titular</span>
          <div className="flex gap-2">
            {state.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(m.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ring-1 transition-all ${
                  memberId === m.id ? "bg-primary/20 text-primary ring-primary/40" : "ring-white/10 text-muted-foreground"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </label>

        <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet">
          Criar Conta
        </button>
      </form>
    </Sheet>
  );
}

// ── Modal: Transferência ──────────────────────────────────────────────────────

function TransferModal({
  onClose,
  onTransfer,
}: {
  onClose: () => void;
  onTransfer: (a: string, b: string, n: number) => void;
}) {
  const { state } = useStore();
  const [from, setFrom] = useState(state.accounts[0]?.id ?? "");
  const [to, setTo] = useState(state.accounts[1]?.id ?? state.accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  return (
    <Sheet onClose={onClose} title="Transferência interna">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseFloat(amount.replace(",", "."));
          if (!v || from === to) return;
          onTransfer(from, to, v);
          onClose();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">De</span>
          <select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>
            {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatBRL(a.balance)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Para</span>
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
            {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Valor</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls + " mono"}
          />
        </label>
        {from === to && (
          <p className="text-xs text-coral">Selecione contas diferentes para transferir.</p>
        )}
        <button
          type="submit"
          disabled={from === to}
          className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet disabled:opacity-50"
        >
          Confirmar transferência
        </button>
      </form>
    </Sheet>
  );
}
