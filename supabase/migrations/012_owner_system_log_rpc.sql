-- ============================================================
-- BrainWare Migration 012 — Owner System Log RPC
-- Permette all'owner di modificare/eliminare righe in qualsiasi
-- tabella dei propri negozi, bypassando RLS
-- Eseguire nel SQL Editor di Supabase
-- ============================================================

-- Funzione per aggiornare una singola cella (usata dal System Log)
CREATE OR REPLACE FUNCTION owner_update_row(
  p_table text,
  p_id uuid,
  p_column text,
  p_value text
) RETURNS void AS $$
DECLARE
  v_role text;
  v_org_id uuid;
  v_allowed boolean := false;
BEGIN
  -- Verifica che l'utente corrente sia un owner
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' AND v_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Solo owner/superadmin possono modificare i dati';
  END IF;

  -- Verifica tabelle consentite
  IF p_table NOT IN (
    'sales', 'sale_items', 'shifts', 'expenses', 'fidelity_cards',
    'day_off_requests', 'warehouse_movements', 'tasks',
    'maintenance_logs', 'notifications'
  ) THEN
    RAISE EXCEPTION 'Tabella non consentita: %', p_table;
  END IF;

  -- Esegui update dinamico
  EXECUTE format(
    'UPDATE %I SET %I = $1 WHERE id = $2',
    p_table, p_column
  ) USING p_value, p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per eliminare una riga (usata dal System Log)
CREATE OR REPLACE FUNCTION owner_delete_row(
  p_table text,
  p_id uuid
) RETURNS void AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' AND v_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Solo owner/superadmin possono eliminare i dati';
  END IF;

  IF p_table NOT IN (
    'sales', 'sale_items', 'shifts', 'expenses', 'fidelity_cards',
    'day_off_requests', 'warehouse_movements', 'tasks',
    'maintenance_logs', 'notifications'
  ) THEN
    RAISE EXCEPTION 'Tabella non consentita: %', p_table;
  END IF;

  EXECUTE format('DELETE FROM %I WHERE id = $1', p_table) USING p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantisci accesso alle funzioni per utenti autenticati
GRANT EXECUTE ON FUNCTION owner_update_row TO authenticated;
GRANT EXECUTE ON FUNCTION owner_delete_row TO authenticated;
