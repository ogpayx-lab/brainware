-- ============================================================
-- BrainWare Migration 018 — Fix Owner Multi-Store RLS
-- Allows owners to manage products (and other resources) across
-- ALL stores in their organization, not just their own store_id
-- ============================================================

-- Helper: returns all store IDs in the owner's organization
CREATE OR REPLACE FUNCTION auth_org_store_ids() RETURNS SETOF UUID AS $$
  SELECT s.id FROM stores s
  WHERE s.organization_id = (
    SELECT s2.organization_id FROM stores s2
    WHERE s2.id = auth_store_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════ PRODUCTS ═══════════════
-- SELECT: owners see all org stores, employees see own store
DROP POLICY IF EXISTS "Store sees products" ON products;
CREATE POLICY "Store sees products" ON products
  FOR SELECT USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );

-- ALL (INSERT/UPDATE/DELETE): owners can manage any org store
DROP POLICY IF EXISTS "Store manages products" ON products;
CREATE POLICY "Store manages products" ON products
  FOR ALL USING (
    store_id = auth_store_id()
    OR store_id IN (SELECT auth_org_store_ids())
  );
