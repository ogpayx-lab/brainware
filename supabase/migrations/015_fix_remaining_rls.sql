-- ============================================================
-- BrainWare Migration 015 — Fix remaining tables without RLS
-- 7 tabelle ancora senza Row Level Security
-- Eseguire nel SQL Editor di Supabase
-- ============================================================

-- 1. PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 2. SHIFTS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- 3. STORES
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 4. USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. SHOPIFY_CONFIG
ALTER TABLE shopify_config ENABLE ROW LEVEL SECURITY;

-- 6. SHIFT_DAY_REQUESTS
ALTER TABLE shift_day_requests ENABLE ROW LEVEL SECURITY;

-- 7. VENDING_SALES (tabella nuova senza RLS)
ALTER TABLE vending_sales ENABLE ROW LEVEL SECURITY;

-- Policy per vending_sales (store-scoped)
DROP POLICY IF EXISTS "Store sees vending sales" ON vending_sales;
CREATE POLICY "Store sees vending sales" ON vending_sales
  FOR SELECT USING (store_id = auth_store_id());

DROP POLICY IF EXISTS "Store manages vending sales" ON vending_sales;
CREATE POLICY "Store manages vending sales" ON vending_sales
  FOR ALL USING (store_id = auth_store_id());

-- ============================================================
-- VERIFICA FINALE
-- ============================================================
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity ASC, tablename;
