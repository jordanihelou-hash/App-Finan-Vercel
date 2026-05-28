import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore, formatBRL } from "@/lib/store";
import { ArrowRightLeft, Wallet } from "lucide-react";
import { Sheet } from "./_app.transactions";

export const Route = createFileRoute("/_app/accounts")({
  head: () => ({
    meta: [
      { title: "Contas — Gestor Financeiro do Casal" },
      { name: "description", content: "Contas, carteiras e saldos do casal em um só lugar." },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const { state, transferBetween } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");
  const [showTransfer, setShowTransfer] = useState(false);

  const total = state.accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <AppHeader
        view={view}
        onViewChange={setView}
        rightSlot={
          <button
            onClick={() => setShowTransfer(true)}
            aria-label="Transferir"
            className="size-10 grid place-items-center bg-primary text-primary-foreground rounded-xl ring-1 ring-primary shadow-[0_4px_14px_-2px_oklch(0.68_0.22_305/0.45)] active:scale-95 transition"
          >
            <ArrowRightLeft className="size-4" />
          </button>
        }
      />

      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5 animate-fade-up relative overflow-hidden">
        <div className="absolute -top-16 -right-16 size-48 bg-primary/15 blur-[60px] rounded-full pointer-events-none" />
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Patrimônio em contas</p>
        <p className="mono text-3xl font-semibold mt-1">{formatBRL(total)}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{state.accounts.length} contas vinculadas</span>
          <span className="text-emerald">● Sincronizadas</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {state.accounts.map((a, i) => {
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
                  <p className="text-[11px] text-muted-foreground truncate">{a.brand} · {member?.name}</p>
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

      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} onTransfer={transferBetween} />}
    </>
  );
}

function TransferModal({ onClose, onTransfer }: { onClose: () => void; onTransfer: (a: string, b: string, n: number) => void }) {
  const { state } = useStore();
  const [from, setFrom] = useState(state.accounts[0]?.id ?? "");
  const [to, setTo] = useState(state.accounts[1]?.id ?? state.accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  const inputCls = "w-full bg-white/5 ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50";

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
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls + " mono"} />
        </label>
        <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet">
          Confirmar
        </button>
      </form>
    </Sheet>
  );
}
