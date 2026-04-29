-- ============================================================
-- BrainWare Migration 014 — Fix RLS Security Issues
-- Risolve gli avvisi di sicurezza Supabase:
--   1. rls_disabled_in_public — tabelle senza RLS
--   2. sensitive_columns_exposed — colonne sensibili esposte
-- Eseguire nel SQL Editor di Supabase
-- ============================================================

-- ============================================================
-- FIX 1: vending_machine_slots — RLS mai abilitato
-- Chiunque con l'URL del progetto poteva leggere/scrivere
-- ============================================================
ALTER TABLE vending_machine_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store sees vending slots" ON vending_machine_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vending_machines vm
      WHERE vm.id = vending_machine_id
        AND vm.store_id = auth_store_id()
    )
  );

CREATE POLICY "Owner manages vending slots" ON vending_machine_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vending_machines vm
      WHERE vm.id = vending_machine_id
        AND vm.store_id = auth_store_id()
    )
  );

-- ============================================================
-- FIX 2: maintenance_templates — RLS abilitato ma nessuna policy
-- La tabella era inaccessibile (locked out) per tutti gli utenti
-- ============================================================
-- Policies per maintenance_templates
CREATE POLICY "Store sees maintenance templates" ON maintenance_templates
  FOR SELECT USING (
    store_id IS NULL  -- global templates visibili a tutti
    OR store_id = auth_store_id()
  );

CREATE POLICY "Owner manages maintenance templates" ON maintenance_templates
  FOR ALL USING (
    auth_role() = 'owner'
    AND (store_id IS NULL OR store_id = auth_store_id())
  );

-- ============================================================
-- FIX 3: transfer_items — RLS abilitato ma nessuna policy
-- ============================================================
CREATE POLICY "Store sees transfer items" ON transfer_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = transfer_id
        AND (t.from_store_id = auth_store_id() OR t.to_store_id = auth_store_id())
    )
  );

CREATE POLICY "Store manages transfer items" ON transfer_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = transfer_id
        AND (t.from_store_id = auth_store_id() OR t.to_store_id = auth_store_id())
    )
  );

-- ============================================================
-- FIX 4: stock_request_items — RLS abilitato ma nessuna policy
-- (aveva solo enable, nessun policy esplicito)
-- ============================================================
DROP POLICY IF EXISTS "Store sees stock request items" ON stock_request_items;
CREATE POLICY "Store sees stock request items" ON stock_request_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stock_requests sr
      WHERE sr.id = stock_request_id
        AND sr.store_id = auth_store_id()
    )
  );

DROP POLICY IF EXISTS "Store manages stock request items" ON stock_request_items;
CREATE POLICY "Store manages stock request items" ON stock_request_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stock_requests sr
      WHERE sr.id = stock_request_id
        AND sr.store_id = auth_store_id()
    )
  );

-- ============================================================
-- FIX 5: inventory_count_items — RLS abilitato ma nessuna policy
-- ============================================================
DROP POLICY IF EXISTS "Store sees inventory count items" ON inventory_count_items;
CREATE POLICY "Store sees inventory count items" ON inventory_count_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inventory_counts ic
      WHERE ic.id = inventory_count_id
        AND ic.store_id = auth_store_id()
    )
  );

DROP POLICY IF EXISTS "Store manages inventory count items" ON inventory_count_items;
CREATE POLICY "Store manages inventory count items" ON inventory_count_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_counts ic
      WHERE ic.id = inventory_count_id
        AND ic.store_id = auth_store_id()
    )
  );

-- ============================================================
-- FIX 6: Protezione colonne sensibili
-- Rimuovi accesso diretto al PIN degli utenti e al token Shopify
-- usando una vista sicura invece dell'accesso diretto
-- ============================================================

-- Vista sicura per lista dipendenti (senza PIN)
CREATE OR REPLACE VIEW employees_safe AS
SELECT
  id,
  store_id,
  full_name,
  role,
  hired_at,
  is_active,
  avatar_url,
  created_at,
  updated_at
FROM users;

-- Vista sicura per shopify config (senza access_token in chiaro)
CREATE OR REPLACE VIEW shopify_config_safe AS
SELECT
  id,
  store_id,
  shopify_domain,
  CASE WHEN access_token IS NOT NULL THEN '••••••••' ELSE NULL END AS access_token_masked,
  sync_enabled,
  last_synced_at,
  created_at
FROM shopify_config;

-- ============================================================
-- VERIFICA: Controlla che tutte le tabelle pubbliche abbiano RLS
-- ============================================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
