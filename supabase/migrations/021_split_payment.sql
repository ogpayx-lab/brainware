-- ============================================================
-- BrainWare Migration 021 — Split Payment Support
-- Adds 'split' payment method for part cash + part POS sales
-- ============================================================

-- Add split value to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'split';

-- Add column to track cash portion of split payments
ALTER TABLE sales ADD COLUMN IF NOT EXISTS split_cash_amount numeric(10,2);

-- Update shift cash summary view to handle split payments
CREATE OR REPLACE VIEW shift_cash_summary AS
SELECT
  s.id                                        as shift_id,
  s.store_id,
  s.user_id,
  s.period,
  s.status,
  s.fce,
  s.fcu,
  s.deposit_actual,
  coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0)
    + coalesce(sum(sa.split_cash_amount) filter (where sa.payment_method = 'split'), 0)
    as total_cash,
  coalesce(sum(sa.total) filter (where sa.payment_method = 'pos'), 0)
    + coalesce(sum(sa.total - coalesce(sa.split_cash_amount, 0)) filter (where sa.payment_method = 'split'), 0)
    as total_pos,
  coalesce(sum(sa.total), 0)                  as total_sales,
  count(sa.id)                                as total_transactions,
  coalesce(sum(e.amount), 0)                  as total_expenses,
  s.fce
    + coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0)
    + coalesce(sum(sa.split_cash_amount) filter (where sa.payment_method = 'split'), 0)
    - coalesce(sum(e.amount), 0)
    - coalesce(s.fcu, 0)                      as deposit_expected,
  s.deposit_actual - (
    s.fce
    + coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0)
    + coalesce(sum(sa.split_cash_amount) filter (where sa.payment_method = 'split'), 0)
    - coalesce(sum(e.amount), 0)
    - coalesce(s.fcu, 0)
  )                                           as cash_variance,
  s.opened_at,
  s.closed_at
FROM shifts s
LEFT JOIN sales sa ON sa.shift_id = s.id
LEFT JOIN expenses e ON e.shift_id = s.id
GROUP BY s.id;
