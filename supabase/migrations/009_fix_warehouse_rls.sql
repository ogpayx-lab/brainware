-- ============================================================
-- 009: Fix RLS policies for warehouses
-- Enables full CRUD for authenticated users on warehouse tables
-- ============================================================

-- WAREHOUSES
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read warehouses" ON warehouses;
CREATE POLICY "Authenticated users can read warehouses" ON warehouses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert warehouses" ON warehouses;
CREATE POLICY "Authenticated users can insert warehouses" ON warehouses
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update warehouses" ON warehouses;
CREATE POLICY "Authenticated users can update warehouses" ON warehouses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete warehouses" ON warehouses;
CREATE POLICY "Authenticated users can delete warehouses" ON warehouses
  FOR DELETE TO authenticated USING (true);

-- WAREHOUSE_STOCK
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read warehouse_stock" ON warehouse_stock;
CREATE POLICY "Authenticated users can read warehouse_stock" ON warehouse_stock
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert warehouse_stock" ON warehouse_stock;
CREATE POLICY "Authenticated users can insert warehouse_stock" ON warehouse_stock
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update warehouse_stock" ON warehouse_stock;
CREATE POLICY "Authenticated users can update warehouse_stock" ON warehouse_stock
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete warehouse_stock" ON warehouse_stock;
CREATE POLICY "Authenticated users can delete warehouse_stock" ON warehouse_stock
  FOR DELETE TO authenticated USING (true);

-- WAREHOUSE_MOVEMENTS
ALTER TABLE warehouse_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read warehouse_movements" ON warehouse_movements;
CREATE POLICY "Authenticated users can read warehouse_movements" ON warehouse_movements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert warehouse_movements" ON warehouse_movements;
CREATE POLICY "Authenticated users can insert warehouse_movements" ON warehouse_movements
  FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS (fix anche per questi)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read notifications" ON notifications;
CREATE POLICY "Authenticated users can read notifications" ON notifications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update notifications" ON notifications;
CREATE POLICY "Authenticated users can update notifications" ON notifications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
