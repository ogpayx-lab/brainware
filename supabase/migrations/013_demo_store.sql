-- ============================================================
-- BrainWare Migration 013 — Demo Store Setup
-- Crea utente demo, negozio demo e dati di esempio
-- Eseguire nel SQL Editor di Supabase
-- ============================================================

-- 1. Crea l'utente demo in auth.users (se non esiste)
-- NOTA: Devi prima creare l'utente tramite la dashboard Supabase:
-- Authentication → Users → Add User →
--   Email: demo@brainware.app
--   Password: BrainWareDemo2026!
--   Auto Confirm: ✓

-- 2. Crea organizzazione demo
INSERT INTO organizations (id, name, slug, plan)
VALUES ('d0000000-0000-0000-0000-000000000001', 'Demo Store', 'demo-store', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

-- 3. Crea negozio demo
INSERT INTO stores (id, name, address, is_active, organization_id)
VALUES (
  'd0000000-0000-0000-0000-000000000002',
  'BrainWare Demo Shop',
  'Via Demo 1, Milano',
  true,
  'd0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Dopo aver creato l'utente auth, inserisci il profilo nella tabella users:
-- (Sostituisci 'AUTH_USER_UUID' con l'UUID effettivo dell'utente creato al punto 1)
--
-- INSERT INTO users (id, email, full_name, role, store_id)
-- VALUES (
--   'AUTH_USER_UUID',
--   'demo@brainware.app',
--   'Demo Owner',
--   'owner',
--   'd0000000-0000-0000-0000-000000000002'
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   role = 'owner',
--   store_id = 'd0000000-0000-0000-0000-000000000002';

-- 5. Store config demo
INSERT INTO store_config (store_id)
VALUES ('d0000000-0000-0000-0000-000000000002')
ON CONFLICT (store_id) DO NOTHING;

-- 6. Prodotti demo
INSERT INTO products (id, store_id, name, category, price, stock_qty, unit, is_active) VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Cannabis Light - Amnesia', 'flowers', 12.00, 250, 'g', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Cannabis Light - Gorilla Glue', 'flowers', 10.00, 180, 'g', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Cannabis Light - White Widow', 'flowers', 8.00, 300, 'g', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'CBD Oil 10%', 'oils', 29.90, 45, 'pz', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'CBD Oil 20%', 'oils', 49.90, 30, 'pz', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Grinder Metallo', 'accessories', 15.00, 20, 'pz', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Cartine King Size', 'accessories', 2.50, 100, 'pz', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Hash CBD - Charas', 'hash', 14.00, 120, 'g', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Hash CBD - Nepal Cream', 'hash', 12.00, 90, 'g', true),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000002', 'Tisana Relax CBD', 'food', 8.50, 60, 'pz', true)
ON CONFLICT DO NOTHING;

-- 7. Nota: Le vendite demo verranno generate dalla prima interazione con il POS,
-- oppure puoi inserirle manualmente. Il negozio sarà visibile immediatamente.

-- ============================================================
-- ISTRUZIONI POST-MIGRATION:
-- 1. Vai su Supabase Dashboard → Authentication → Users
-- 2. Clicca "Add User" (invito manuale)
-- 3. Email: demo@brainware.app
-- 4. Password: BrainWareDemo2026!
-- 5. Spunta "Auto Confirm User"
-- 6. Dopo la creazione, copia l'UUID dell'utente
-- 7. Esegui l'INSERT della tabella users (punto 4) con l'UUID copiato
-- ============================================================
