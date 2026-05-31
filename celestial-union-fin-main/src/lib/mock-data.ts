export type TxType = "income" | "expense";

export interface Member {
  id: string;
  name: string;
  avatarColor: string;
  initial: string;
}

export interface Category {
  id: string;
  name: string;
  type: TxType;
  color: "violet" | "emerald" | "coral" | "amber" | "cyan";
  /** Teto mensal da categoria em R$ (opcional, usado no gráfico de extrapolação) */
  budget?: number;
}

export interface Account {
  id: string;
  name: string;
  type: "Conta Corrente" | "Poupança" | "Carteira Digital" | "Dinheiro" | "Investimentos";
  balance: number;
  memberId: string;
  brand?: string;
}

export type TxStatus = "previsto" | "pago";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO
  type: TxType;
  categoryId: string;
  memberId: string;
  accountId: string;
  status: TxStatus;
}

export interface InvestmentMove {
  id: string;
  kind: "aporte" | "resgate";
  amount: number;
  date: string;
}

/** Meta financeira à qual um investimento pode estar vinculado */
export interface InvestmentGoal {
  id: string;
  name: string;
  emoji: string;
  targetAmount?: number; // valor-alvo da meta (opcional)
}

export interface Investment {
  id: string;
  name: string;
  ticker?: string;
  type: "Renda Fixa" | "Ações" | "Fundos" | "Criptomoedas";
  applied: number;
  projectedYield: number; // % a.a.
  moves: InvestmentMove[];
  /** ID da meta associada (obrigatório no fluxo de criação) */
  goalId?: string;
}

export const INVESTMENT_GOALS: InvestmentGoal[] = [
  { id: "fundo_emergencial", name: "Fundo de Emergência", emoji: "🛡️", targetAmount: 50000 },
  { id: "entrada_imovel", name: "Entrada Imóvel", emoji: "🏠", targetAmount: 120000 },
  { id: "aposentadoria", name: "Aposentadoria", emoji: "🌴" },
  { id: "viagem_ferias", name: "Viagem / Férias", emoji: "✈️", targetAmount: 15000 },
  { id: "veiculo", name: "Veículo", emoji: "🚗", targetAmount: 60000 },
  { id: "educacao", name: "Educação", emoji: "📚" },
];

export const MEMBERS: Member[] = [
  { id: "m1", name: "Marina", initial: "M", avatarColor: "from-violet-400 to-fuchsia-500" },
  { id: "m2", name: "Rafael", initial: "R", avatarColor: "from-cyan-400 to-blue-500" },
];

export const CATEGORIES: Category[] = [
  { id: "c1", name: "Salário", type: "income", color: "emerald" },
  { id: "c2", name: "Freelance", type: "income", color: "emerald" },
  { id: "c3", name: "Dividendos", type: "income", color: "cyan" },
  { id: "c4", name: "Moradia", type: "expense", color: "violet", budget: 3500 },
  { id: "c5", name: "Alimentação", type: "expense", color: "amber", budget: 600 },
  { id: "c6", name: "Transporte", type: "expense", color: "coral", budget: 500 },
  { id: "c7", name: "Lazer", type: "expense", color: "coral", budget: 300 },
  { id: "c8", name: "Assinaturas", type: "expense", color: "violet", budget: 150 },
  { id: "c9", name: "Mercado", type: "expense", color: "amber", budget: 1200 },
];

export const ACCOUNTS: Account[] = [
  { id: "a1", name: "Itaú Corrente", type: "Conta Corrente", balance: 14320.5, memberId: "m1", brand: "Itaú" },
  { id: "a2", name: "Nubank", type: "Carteira Digital", balance: 8210.0, memberId: "m1", brand: "Nubank" },
  { id: "a3", name: "Inter Conjunta", type: "Conta Corrente", balance: 18900.0, memberId: "m2", brand: "Inter" },
  { id: "a4", name: "Reserva Liquidez", type: "Investimentos", balance: 6402.0, memberId: "m2", brand: "XP" },
];

const today = new Date();
const d = (offset: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() - offset);
  return x.toISOString();
};

export const TRANSACTIONS: Transaction[] = [
  { id: "t1", description: "Salário Marina", amount: 9800, date: d(2), type: "income", categoryId: "c1", memberId: "m1", accountId: "a1", status: "pago" },
  { id: "t2", description: "Salário Rafael", amount: 8440, date: d(2), type: "income", categoryId: "c1", memberId: "m2", accountId: "a3", status: "pago" },
  { id: "t3", description: "Aluguel", amount: 3200, date: d(4), type: "expense", categoryId: "c4", memberId: "m1", accountId: "a1", status: "pago" },
  { id: "t4", description: "Mercado Pão de Açúcar", amount: 842.31, date: d(5), type: "expense", categoryId: "c9", memberId: "m2", accountId: "a3", status: "pago" },
  { id: "t5", description: "Uber", amount: 124.5, date: d(6), type: "expense", categoryId: "c6", memberId: "m1", accountId: "a2", status: "pago" },
  { id: "t6", description: "Jantar Sushi Tetsu", amount: 412.0, date: d(7), type: "expense", categoryId: "c5", memberId: "m2", accountId: "a3", status: "pago" },
  { id: "t7", description: "Netflix", amount: 55.9, date: d(8), type: "expense", categoryId: "c8", memberId: "m1", accountId: "a2", status: "pago" },
  { id: "t8", description: "Spotify Família", amount: 34.9, date: d(9), type: "expense", categoryId: "c8", memberId: "m2", accountId: "a3", status: "previsto" },
  { id: "t9", description: "Dividendos ITSA4", amount: 218.4, date: d(10), type: "income", categoryId: "c3", memberId: "m2", accountId: "a4", status: "pago" },
  { id: "t10", description: "Cinema IMAX", amount: 168.0, date: d(11), type: "expense", categoryId: "c7", memberId: "m1", accountId: "a2", status: "pago" },
  { id: "t11", description: "Freela design", amount: 2400, date: d(12), type: "income", categoryId: "c2", memberId: "m1", accountId: "a1", status: "pago" },
  { id: "t12", description: "Posto Shell", amount: 280.0, date: d(13), type: "expense", categoryId: "c6", memberId: "m2", accountId: "a3", status: "previsto" },
];

export const INVESTMENTS: Investment[] = [
  {
    id: "i1",
    name: "Tesouro IPCA+ 2035",
    type: "Renda Fixa",
    applied: 42000,
    projectedYield: 11.4,
    goalId: "fundo_emergencial",
    moves: [
      { id: "mv1", kind: "aporte", amount: 30000, date: d(180) },
      { id: "mv2", kind: "aporte", amount: 12000, date: d(60) },
    ],
  },
  {
    id: "i2",
    name: "ITSA4",
    ticker: "ITSA4",
    type: "Ações",
    applied: 18400,
    projectedYield: 9.2,
    goalId: "aposentadoria",
    moves: [{ id: "mv3", kind: "aporte", amount: 18400, date: d(90) }],
  },
  {
    id: "i3",
    name: "Fundo Verde FIC FIM",
    type: "Fundos",
    applied: 64800,
    projectedYield: 13.8,
    goalId: "aposentadoria",
    moves: [{ id: "mv4", kind: "aporte", amount: 64800, date: d(220) }],
  },
  {
    id: "i4",
    name: "Bitcoin",
    ticker: "BTC",
    type: "Criptomoedas",
    applied: 29000,
    projectedYield: 22.5,
    goalId: "viagem_ferias",
    moves: [
      { id: "mv5", kind: "aporte", amount: 25000, date: d(300) },
      { id: "mv6", kind: "aporte", amount: 4000, date: d(40) },
    ],
  },
];
