-- ============================================================
-- BrainWare Migration 019 — Membership Card Upgrade
-- Adds self-service membership registration for customer tablets
-- ============================================================

-- 1. Add resident flag to fidelity_cards
ALTER TABLE fidelity_cards ADD COLUMN IF NOT EXISTS is_resident boolean NOT NULL DEFAULT false;

-- 2. Add slug to stores for clean URLs
ALTER TABLE stores ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs from existing store names
UPDATE stores SET slug = lower(
  regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
) WHERE slug IS NULL;

-- 3. Allow anonymous users to INSERT membership cards (self-registration from kiosk)
DROP POLICY IF EXISTS "Anon can register membership" ON fidelity_cards;
CREATE POLICY "Anon can register membership" ON fidelity_cards
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to SELECT cards by phone (points check)
DROP POLICY IF EXISTS "Anon can check points" ON fidelity_cards;
CREATE POLICY "Anon can check points" ON fidelity_cards
  FOR SELECT TO anon USING (true);

-- Allow anonymous to read store info (for kiosk page)
DROP POLICY IF EXISTS "Anon can read stores" ON stores;
CREATE POLICY "Anon can read stores" ON stores
  FOR SELECT TO anon USING (true);

-- Allow anonymous to read fidelity transactions (for points history)
DROP POLICY IF EXISTS "Anon can read fidelity txns" ON fidelity_transactions;
CREATE POLICY "Anon can read fidelity txns" ON fidelity_transactions
  FOR SELECT TO anon USING (true);
