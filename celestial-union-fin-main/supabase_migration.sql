-- ============================================================
-- Migração: bifásico (status) + metas de investimento (goal_id)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Adiciona coluna status em transactions
--    'pago' é o padrão para não quebrar dados existentes
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pago'
  CHECK (status IN ('pago', 'previsto'));

-- 2. Marca todas as transações existentes como 'pago' (retroativo)
UPDATE transactions SET status = 'pago' WHERE status IS NULL;

-- 3. Adiciona coluna goal_id em investments (FK opcional para goals)
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS goal_id TEXT;

-- 4. (Opcional) Índice para buscas por goal
CREATE INDEX IF NOT EXISTS idx_investments_goal_id ON investments(goal_id);

-- ============================================================
-- Migração 2: grupos e orçamento nas categorias
-- ============================================================

-- 5. Adiciona group (enquadramento 50/30/20) e budget nas categorias
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS group TEXT CHECK (group IN ('necessidades', 'estilo_vida'));

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS budget NUMERIC;

-- Verificação
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('transactions', 'investments', 'categories')
  AND column_name IN ('status', 'goal_id', 'group', 'budget')
ORDER BY table_name, column_name;
