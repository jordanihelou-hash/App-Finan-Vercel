import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { KpiCard } from "@/components/KpiCard";
import { GeminiAdvisor } from "@/components/GeminiAdvisor";
import { CashflowChart } from "@/components/CashflowChart";
import { useStore, formatBRL } from "@/lib/store";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { state } = useStore();
  const [view, setView] = useState<"unified" | "individual">("unified");

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Filtra transações por modo (individual = só do usuário logado)
  const baseTx = useMemo(() => {
    if (view === "individual" && state.currentUserId) {
      return state.transactions.filter((t) => t.memberId === state.currentUserId);
    }
    return state.transactions;
  }, [state.transactions, state.currentUserId, view]);

  const baseAccounts = useMemo(() => {
    if (view === "individual" && state.currentUserId) {
      return state.accounts.filter((a) => a.memberId === state.currentUserId);
    }
    return state.accounts;
  }, [state.accounts, state.currentUserId, view]);

  const monthTx = baseTx.filter((t) => new Date(t.date) >= monthStart);
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const total = baseAccounts.reduce((s, a) => s + a.balance, 0);
  const invested = state.investments.reduce((s, i) => s + i.applied, 0);

  // Dados do mês atual (dia a dia)
  const chartData = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days: { label: string; income: number; expense: number; date: Date }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      d.setHours(0, 0, 0, 0);
      days.push({ label: String(i).padStart(2, "0"), income: 0, expense: 0, date: d });
    }
    baseTx.forEach((t) => {
      const td = new Date(t.date);
      if (td.getMonth() !== now.getMonth() || td.getFullYear() !== now.getFullYear()) return;
      td.setHours(0, 0, 0, 0);
      const bucket = days.find((b) => b.date.getTime() === td.getTime());
      if (bucket) {
        if (t.type === "income") bucket.income += t.amount;
        else bucket.expense += t.amount;
      }
    });
    return days;
  }, [baseTx]);

  const expensePct =
    income > 0 ? `${((expense / income) * 100).toFixed(0)}% da renda` : "— da renda";

  return (
    <>
      <AppHeader view={view} onViewChange={setView} />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Saldo Total" value={total} trend={view === "individual" ? "Seu saldo" : "+2.4% mês"} trendTone="up" />
        <KpiCard label="Investido" value={invested} accent="amber" trend="Carteira ativa" />
        <KpiCard label="Receitas" value={income} accent="emerald" trend="No mês" />
        <KpiCard label="Despesas" value={expense} accent="coral" trend={expensePct} />
      </div>

      <CashflowChart
        data={chartData}
        allTransactions={baseTx.map((t) => ({ date: t.date, type: t.type, amount: t.amount }))}
        totalBalance={total}
      />

      {view === "individual" && state.members.length > 0 && <IndividualView />}

      <GeminiAdvisor income={income} expense={expense} invested={invested} />
    </>
  );
}

function IndividualView() {
  const { state } = useStore();
  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Resumo por membro</h2>
      {state.members.map((m) => {
        const tx = state.transactions.filter((t) => t.memberId === m.id);
        const income = tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = tx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const balance = state.accounts.filter((a) => a.memberId === m.id).reduce((s, a) => s + a.balance, 0);
        return (
          <div key={m.id} className="glass-card ring-1 ring-white/10 ring-inset-soft rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`size-10 rounded-full grid place-items-center text-sm font-semibold text-white bg-gradient-to-br ${m.avatarColor}`}>
                {m.initial}
              </div>
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-[11px] text-muted-foreground">{tx.length} transação{tx.length !== 1 ? "ões" : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Saldo" value={balance} />
              <Row label="Líquido" value={income - expense} tone={income - expense >= 0 ? "emerald" : "coral"} />
              <Row label="Receitas" value={income} tone="emerald" />
              <Row label="Despesas" value={expense} tone="coral" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "coral" }) {
  const cls = tone === "emerald" ? "text-emerald" : tone === "coral" ? "text-coral" : "text-foreground";
  return (
    <div className="bg-white/5 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`mono text-sm font-medium mt-1 ${cls}`}>{formatBRL(value)}</p>
    </div>
  );
}
