-- ============================================================
-- BrainWare Migration 022 — Multi-store RLS for owner visibility
-- Owner must see sales, shifts, expenses from ALL org stores
-- ============================================================

-- SALES: owner sees all org stores
DROP POLICY IF EXISTS "Store sees sales" ON sales;
CREATE POLICY "Store sees sales" ON sales
  FOR SELECT USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );

-- SALE ITEMS: via join on sales
DROP POLICY IF EXISTS "Store sees sale items" ON sale_items;
CREATE POLICY "Store sees sale items" ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales s WHERE s.id = sale_id
      AND (s.store_id = auth_store_id() OR s.store_id IN (SELECT auth_org_store_ids()))
    )
  );

-- SHIFTS: owner sees all org shifts
DROP POLICY IF EXISTS "Store manages shifts" ON shifts;
CREATE POLICY "Store manages shifts" ON shifts
  FOR ALL USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );

-- EXPENSES: owner sees all org expenses
DROP POLICY IF EXISTS "Store sees expenses" ON expenses;
CREATE POLICY "Store sees expenses" ON expenses
  FOR SELECT USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );

-- FIDELITY CARDS: owner sees all org members
DROP POLICY IF EXISTS "Store sees fidelity cards" ON fidelity_cards;
CREATE POLICY "Store sees fidelity cards" ON fidelity_cards
  FOR SELECT USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );

-- STOCK REQUESTS: owner sees all org stock requests
DROP POLICY IF EXISTS "Store sees stock requests" ON stock_requests;
CREATE POLICY "Store sees stock requests" ON stock_requests
  FOR ALL USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );
