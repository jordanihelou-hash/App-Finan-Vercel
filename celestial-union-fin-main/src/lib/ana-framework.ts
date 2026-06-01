/**
 * Framework de Inteligência Financeira para Casais
 * Base de conhecimento e regras de negócio da assistente Ana.
 *
 * Fonte: "Framework de Inteligência Financeira para Casais —
 *         Base de Conhecimento e Regras de Negócio para Assistente Virtual"
 */

export const ANA_FRAMEWORK = `
═══════════════════════════════════════════════════════════════
BASE DE CONHECIMENTO — FRAMEWORK FINANCEIRO DO CASAL
═══════════════════════════════════════════════════════════════

## 1. ARQUITETURA DE CATEGORIAS (Regra 50/30/20 Adaptada)

### 1.1 NECESSIDADES BÁSICAS — até 50% da Renda Líquida
Subcategorias:
- Habitação: aluguel, financiamento imobiliário, condomínio, IPTU, seguro residencial.
- Contas de consumo: energia, água, gás, internet, planos de celular.
- Alimentação essencial: supermercado, feira, açougue. (Delivery e jantares fora NÃO entram aqui.)
- Transporte obrigatório: financiamento/seguro/IPVA de automóvel, combustível habitual, transporte público.
- Saúde básica: plano de saúde, plano odontológico, medicamentos de uso contínuo, seguro de vida.
- Educação/formação: mensalidades escolares, faculdade, pós-graduação, cursos em andamento.

### 1.2 ESTILO DE VIDA E LAZER — até 30% da Renda Líquida
Subcategorias:
- Lazer e entretenimento: jantares fora, bares, cinema, shows, viagens, hotéis.
- Cuidados pessoais: academia, salão, barbearia, cosméticos não essenciais.
- Compras gerais: roupas, calçados, eletrônicos, decoração.
- Assinaturas/serviços: Netflix, Spotify, Amazon Prime e similares.
- Pets (conforto): ração premium, banho, tosa, veterinário de rotina.

### 1.3 FUTURO E SEGURANÇA — mínimo 20% da Renda Líquida
Subcategorias:
- Reserva de Emergência: ativos de liquidez imediata e baixíssimo risco (prioridade máxima).
- Projetos de médio prazo: compra de carro, viagens, reformas, casamentos.
- Independência financeira: previdência, carteira de dividendos, ações, longo prazo.

### Ajuste para Renda Variável (Autônomos/Profissionais Liberais)
Use a proporção 45% / 25% / 30% (comprimindo gastos fixos e expandindo poupança para
amortecer meses de baixa captação).

---

## 2. LÓGICA DE DIVISÃO PROPORCIONAL ENTRE PARCEIROS

O app opera com visão unificada das contas individuais (conta conjunta é opcional).
A Ana atua como um "Clearing Automático".

### Fórmulas:
- R_Total = R_A + R_B
- P_A = R_A / R_Total  |  P_B = R_B / R_Total
- Meta_Absoluta_A = G_Total × P_A  |  Meta_Absoluta_B = G_Total × P_B

### Algoritmo de Sugestão de Pagamento:
1. Mapear todas as contas marcadas como "Compromisso do Casal" no mês.
2. Distribuir cada conta para o parceiro com saldo disponível, somando até atingir
   a Meta_Absoluta de cada um.
3. Se o Parceiro A pagou R$ 3.200 e sua meta era R$ 3.000, sugerir micro-transferência:
   "Para equilibrar o mês, o Parceiro B deve transferir R$ 200 para o Parceiro A
   ou assumir o próximo investimento programado de R$ 200."

---

## 3. TRATAMENTO DE CENÁRIOS COMPLEXOS

### 3.1 Renda Variável
- Média Trimestral Móvel: calcular média simples dos últimos 3 ou 6 meses.
- Pró-Labore Fixo: retirada mensal fixa da empresa; excedentes vão para investimentos.

### 3.2 Alta Disparidade de Renda (ex: R$ 50k vs R$ 5k)
A divisão proporcional pura pode ser injusta. Sugerir dois modelos:

Modelo A — Unificação Total com Mesadas Iguais:
  Toda receita centralizada virtualmente; necessidades e investimentos pagos pelo pool.
  Saldo de lazer dividido em partes iguais para cada parceiro.

Modelo B — Subvenção pelo Parceiro de Maior Renda:
  Despesas básicas proporcionais; gastos discricionários de alto padrão (viagens
  internacionais, restaurantes de luxo) custeados integralmente pelo parceiro de maior
  renda, eximindo o de menor renda de comprometer seu teto.

---

## 4. MATRIZ DE ALOCAÇÃO DOS 20% DE INVESTIMENTOS

Fase 1 — Construção (sem reserva): 80% Emergência | 0% Projetos | 20% Aposentadoria
Fase 2 — Equilíbrio (reserva OK):  10% Emergência | 50% Projetos | 40% Aposentadoria
Fase 3 — Aceleração (patrimônio forte): 0% Emergência | 30% Projetos | 70% Aposentadoria

### Diretrizes de Ativos por Destino:
- Reserva de Emergência: liquidez diária, pós-fixados (Tesouro Selic, CDB 100% CDI).
  Alvo: 6 meses de custo fixo (assalariados) ou 12 meses (renda variável).
- Projetos: renda fixa com vencimento casado com a data do objetivo (IPCA+, Pré-fixados curtos).
- Aposentadoria: ativos geradores de renda e crescimento (FIIs, Ações, ETFs globais,
  Previdência Privada estruturada).

═══════════════════════════════════════════════════════════════
`;
