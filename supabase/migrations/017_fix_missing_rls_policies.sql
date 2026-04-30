-- ============================================================
-- Migration 017: Add missing RLS policies for core tables
-- Fix: migration 015 enabled RLS on users, products, shifts, 
-- stores, shift_day_requests but without policies, blocking all access
-- ============================================================

-- ═══════════════ USERS ═══════════════
-- Users can read their own profile
DROP POLICY IF EXISTS "Users read own profile" ON users;
CREATE POLICY "Users read own profile" ON users
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users update own profile" ON users;
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Users in the same store can see each other (needed for team features)
DROP POLICY IF EXISTS "Store users can see colleagues" ON users;
CREATE POLICY "Store users can see colleagues" ON users
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow insert for new signups (service role handles this, but just in case)
DROP POLICY IF EXISTS "Allow user self insert" ON users;
CREATE POLICY "Allow user self insert" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- ═══════════════ STORES ═══════════════
-- Users can read their own store
DROP POLICY IF EXISTS "Users read own store" ON stores;
CREATE POLICY "Users read own store" ON stores
  FOR SELECT USING (
    id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- Owners can update their store
DROP POLICY IF EXISTS "Owners update own store" ON stores;
CREATE POLICY "Owners update own store" ON stores
  FOR UPDATE USING (
    id IN (
      SELECT store_id FROM users WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Allow store creation during onboarding
DROP POLICY IF EXISTS "Allow store creation" ON stores;
CREATE POLICY "Allow store creation" ON stores
  FOR INSERT WITH CHECK (true);

-- ═══════════════ PRODUCTS ═══════════════
DROP POLICY IF EXISTS "Store sees products" ON products;
CREATE POLICY "Store sees products" ON products
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store manages products" ON products;
CREATE POLICY "Store manages products" ON products
  FOR ALL USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- ═══════════════ SHIFTS ═══════════════
DROP POLICY IF EXISTS "Store sees shifts" ON shifts;
CREATE POLICY "Store sees shifts" ON shifts
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store manages shifts" ON shifts;
CREATE POLICY "Store manages shifts" ON shifts
  FOR ALL USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- ═══════════════ SHIFT_DAY_REQUESTS ═══════════════
DROP POLICY IF EXISTS "Store sees shift day requests" ON shift_day_requests;
CREATE POLICY "Store sees shift day requests" ON shift_day_requests
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store manages shift day requests" ON shift_day_requests;
CREATE POLICY "Store manages shift day requests" ON shift_day_requests
  FOR ALL USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );
