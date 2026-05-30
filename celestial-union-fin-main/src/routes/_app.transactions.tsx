import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useStore, formatBRL } from "@/lib/store";
import { Search, X, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const { state, addTransaction, addCategory } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");
  const [query, setQuery] = useState("");
  const [showCat, setShowCat] = useState(false);

  const filtered = useMemo(() => {
    let list = state.transactions;
    // Individual view: show only current user's transactions
    if (view === "individual" && state.currentUserId) {
      list = list.filter((t) => t.memberId === state.currentUserId);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          state.categories.find((c) => c.id === t.categoryId)?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [state.transactions, state.categories, query, view, state.currentUserId]);

  return (
    <>
      {/* FAB global está no layout — sem botão no rightSlot */}
      <AppHeader view={view} onViewChange={setView} />

      <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl px-4 py-3 flex items-center gap-3">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar descrição ou categoria…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-w-0"
        />
        {query && (
          <button onClick={() => setQuery("")}>
            <X className="size-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between -mb-1">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {view === "individual" ? "Meus Lançamentos" : "Lançamentos do Casal"}
        </h2>
      </div>

      <div className="flex flex-col gap-2 animate-fade-up">
        {filtered.map((t) => {
          const cat = state.categories.find((c) => c.id === t.categoryId);
          const member = state.members.find((m) => m.id === t.memberId);
          return (
            <div
              key={t.id}
              className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-xl p-3 flex items-center gap-3"
            >
              <div className={`size-10 shrink-0 rounded-xl grid place-items-center ${t.type === "income" ? "bg-emerald/10 text-emerald" : "bg-coral/10 text-coral"}`}>
                {t.type === "income" ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {cat?.name} · {member?.name} · {new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <span className={`mono text-sm font-semibold shrink-0 ${t.type === "income" ? "text-emerald" : "text-coral"}`}>
                {t.type === "income" ? "+" : "−"}{formatBRL(t.amount)}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</div>
        )}
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Categorias</h2>
        <div className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-4 space-y-2">
          {state.categories.map((c) => {
            const total = state.transactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
            return (
              <div key={c.id} className="flex items-center justify-between py-1 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`size-1.5 rounded-full ${dotColor(c.color)}`} />
                  <span className="truncate">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase shrink-0">{c.type === "income" ? "Rec." : "Desp."}</span>
                </div>
                <span className="mono text-muted-foreground shrink-0">{formatBRL(total)}</span>
              </div>
            );
          })}
          <button
            onClick={() => setShowCat(true)}
            className="mt-1 w-full flex items-center gap-1.5 text-[11px] text-primary font-medium py-1"
          >
            <Plus className="size-3" /> Nova categoria
          </button>
        </div>
      </div>

      {showCat && <AddCategoryModal onClose={() => setShowCat(false)} onSave={addCategory} />}
    </>
  );
}

function dotColor(c: string) {
  return c === "emerald" ? "bg-emerald" : c === "coral" ? "bg-coral" : c === "amber" ? "bg-amber" : c === "cyan" ? "bg-cyan" : "bg-primary";
}

// ── Estilo base para inputs e selects ────────────────────────────────────────
/**
 * Usa fundo explícito em vez de bg-white/5 (que é quase transparente e pode
 * causar texto branco-sobre-branco em selects nativos em alguns browsers).
 */
const inputCls = "w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-primary/50 transition-all text-foreground";

// ── AddTransactionModal ───────────────────────────────────────────────────────

interface AddTransactionProps {
  onClose: () => void;
  onSave: ReturnType<typeof useStore>["addTransaction"];
  /** Pré-seleciona o membro (ex: modo individual) */
  defaultMemberId?: string;
}

export function AddTransactionModal({ onClose, onSave, defaultMemberId }: AddTransactionProps) {
  const { state, addCategory } = useStore();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(state.categories.find((c) => c.type === "expense")?.id ?? "");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [memberId, setMemberId] = useState(defaultMemberId ?? state.members[0]?.id ?? "");
  const [showInlineCat, setShowInlineCat] = useState(false);

  const cats = state.categories.filter((c) => c.type === type);

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "__new__") {
      setShowInlineCat(true);
    } else {
      setCategoryId(e.target.value);
    }
  }

  return (
    <Sheet onClose={onClose} title="Novo Lançamento">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseFloat(amount.replace(",", "."));
          if (!description || !v || v <= 0) return;
          // Se não há conta selecionada, usa string vazia (será tratado pelo backend)
          onSave({
            description, amount: v, date: new Date().toISOString(),
            type, categoryId, accountId: accountId || "", memberId,
          });
          onClose();
        }}
        className="space-y-4"
      >
        {/* Tipo */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t} type="button"
              onClick={() => {
                setType(t);
                setCategoryId(state.categories.find((c) => c.type === t)?.id ?? "");
                setShowInlineCat(false);
              }}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                type === t ? (t === "income" ? "bg-emerald/20 text-emerald" : "bg-coral/20 text-coral") : "text-muted-foreground"
              }`}
            >
              {t === "income" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        <Field label="Descrição">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mercado da semana" />
        </Field>

        <Field label="Valor (R$)">
          <input className={inputCls + " mono"} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </Field>

        {/* Categoria com opção de adicionar nova inline */}
        <Field label="Categoria">
          {showInlineCat ? (
            <AddInlineCategory
              type={type}
              onSave={async (c) => {
                await addCategory(c);
                setShowInlineCat(false);
              }}
              onCancel={() => setShowInlineCat(false)}
            />
          ) : (
            <select className={inputCls} value={categoryId} onChange={handleCategoryChange}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new__">+ Adicionar categoria…</option>
            </select>
          )}
        </Field>

        {/* Conta */}
        <Field label="Conta">
          {state.accounts.length === 0 ? (
            <div className="w-full bg-[oklch(0.17_0.05_290)] ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-sm text-muted-foreground flex items-center justify-between">
              <span>Nenhuma conta cadastrada</span>
              <span className="text-[10px] text-primary">→ aba Contas</span>
            </div>
          ) : (
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </Field>

        {/* Parceiro */}
        <Field label="Parceiro">
          <div className="flex gap-2">
            {state.members.map((m) => (
              <button
                key={m.id} type="button" onClick={() => setMemberId(m.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ring-1 transition-all ${
                  memberId === m.id ? "bg-primary/20 text-primary ring-primary/40" : "ring-white/10 text-muted-foreground"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </Field>

        <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet">
          Salvar Lançamento
        </button>
      </form>
    </Sheet>
  );
}

/** Mini-formulário inline para criar nova categoria dentro do modal */
function AddInlineCategory({
  type,
  onSave,
  onCancel,
}: {
  type: "income" | "expense";
  onSave: (c: { name: string; type: "income" | "expense"; color: "violet" | "emerald" | "coral" | "amber" | "cyan" }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<"violet" | "emerald" | "coral" | "amber" | "cyan">("violet");

  return (
    <div className="space-y-2 p-3 bg-white/5 rounded-lg ring-1 ring-primary/20">
      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Nova categoria</p>
      <input
        className={inputCls}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da categoria"
        autoFocus
      />
      <div className="flex gap-2 items-center">
        {(["violet", "emerald", "coral", "amber", "cyan"] as const).map((c) => (
          <button
            key={c} type="button" onClick={() => setColor(c)}
            className={`size-7 rounded-full ${dotColor(c)} ring-2 transition-all ${color === c ? "ring-white scale-110" : "ring-transparent"}`}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { if (name.trim()) onSave({ name: name.trim(), type, color }); }}
          className="flex-1 py-2 bg-primary/20 text-primary rounded-lg text-xs font-medium"
        >
          Criar
        </button>
        <button type="button" onClick={onCancel} className="flex-1 py-2 bg-white/5 text-muted-foreground rounded-lg text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── AddCategoryModal ──────────────────────────────────────────────────────────

function AddCategoryModal({ onClose, onSave }: { onClose: () => void; onSave: ReturnType<typeof useStore>["addCategory"] }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState<"violet" | "emerald" | "coral" | "amber" | "cyan">("violet");

  return (
    <Sheet onClose={onClose} title="Nova Categoria">
      <form
        onSubmit={(e) => { e.preventDefault(); if (!name) return; onSave({ name, type, color }); onClose(); }}
        className="space-y-4"
      >
        <Field label="Nome">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pets" />
        </Field>
        <Field label="Tipo">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </Field>
        <Field label="Cor">
          <div className="flex gap-2">
            {(["violet", "emerald", "coral", "amber", "cyan"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`size-9 rounded-full ${dotColor(c)} ring-2 ${color === c ? "ring-white" : "ring-transparent"}`} />
            ))}
          </div>
        </Field>
        <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl glow-violet">
          Criar Categoria
        </button>
      </form>
    </Sheet>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-up" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md glass-card ring-1 ring-white/10 ring-inset-soft rounded-t-3xl sm:rounded-2xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl max-h-[90dvh] overflow-y-auto"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-white/5 grid place-items-center">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
