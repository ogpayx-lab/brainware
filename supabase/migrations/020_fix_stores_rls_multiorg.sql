-- ============================================================
-- BrainWare Migration 020 — Fix stores RLS for multi-store orgs
-- Owner must be able to read ALL stores in their organization
-- for notifications, analytics, and cross-store management
-- ============================================================

-- Fix: allow users to read all stores in their organization
DROP POLICY IF EXISTS "Users read own store" ON stores;
CREATE POLICY "Users read own store" ON stores
  FOR SELECT USING (
    id = auth_store_id()
    OR id IN (SELECT auth_org_store_ids())
  );
