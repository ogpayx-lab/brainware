-- ============================================================
-- BrainWare Migration 017 — Fix RLS Policies (No Recursion)
-- Uses auth_store_id() SECURITY DEFINER function to avoid
-- infinite recursion when policies reference the users table
-- ============================================================

-- Ensure auth_store_id() exists and uses SECURITY DEFINER
CREATE OR REPLACE FUNCTION auth_store_id() RETURNS UUID AS $$
  SELECT store_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════ USERS ═══════════════
DROP POLICY IF EXISTS "Users read own profile" ON users;
CREATE POLICY "Users read own profile" ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON users;
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Store users can see colleagues" ON users;
CREATE POLICY "Store users can see colleagues" ON users
  FOR SELECT USING (store_id = auth_store_id());

DROP POLICY IF EXISTS "Allow user self insert" ON users;
CREATE POLICY "Allow user self insert" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- ═══════════════ STORES ═══════════════
DROP POLICY IF EXISTS "Users read own store" ON stores;
CREATE POLICY "Users read own store" ON stores
  FOR SELECT USING (id = auth_store_id());

DROP POLICY IF EXISTS "Owners update own store" ON stores;
CREATE POLICY "Owners update own store" ON stores
  FOR UPDATE USING (
    id = auth_store_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
  );

DROP POLICY IF EXISTS "Allow store creation" ON stores;
CREATE POLICY "Allow store creation" ON stores
  FOR INSERT WITH CHECK (true);

-- ═══════════════ PRODUCTS ═══════════════
DROP POLICY IF EXISTS "Store sees products" ON products;
CREATE POLICY "Store sees products" ON products
  FOR SELECT USING (store_id = auth_store_id());

DROP POLICY IF EXISTS "Store manages products" ON products;
CREATE POLICY "Store manages products" ON products
  FOR ALL USING (store_id = auth_store_id());

-- ═══════════════ SHIFTS ═══════════════
DROP POLICY IF EXISTS "Store sees shifts" ON shifts;
CREATE POLICY "Store sees shifts" ON shifts
  FOR SELECT USING (store_id = auth_store_id());

DROP POLICY IF EXISTS "Store manages shifts" ON shifts;
CREATE POLICY "Store manages shifts" ON shifts
  FOR ALL USING (store_id = auth_store_id());

-- ═══════════════ SHIFT DAY REQUESTS ═══════════════
DROP POLICY IF EXISTS "Store sees shift day requests" ON shift_day_requests;
CREATE POLICY "Store sees shift day requests" ON shift_day_requests
  FOR SELECT USING (store_id = auth_store_id());

DROP POLICY IF EXISTS "Store manages shift day requests" ON shift_day_requests;
CREATE POLICY "Store manages shift day requests" ON shift_day_requests
  FOR ALL USING (store_id = auth_store_id());
