-- ============================================================
-- Migration: Store Sessions + Employee Check-in/out + PIN
-- ============================================================

-- 1. Add PIN field to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin VARCHAR(4);

-- 2. Create shift_checkins table
CREATE TABLE IF NOT EXISTS shift_checkins (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id        uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id),
  store_id        uuid NOT NULL REFERENCES stores(id),
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS for shift_checkins
ALTER TABLE shift_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store sees checkins" ON shift_checkins
  FOR SELECT USING (store_id = auth_store_id());

CREATE POLICY "Employee manages checkins" ON shift_checkins
  FOR ALL USING (store_id = auth_store_id());

-- 4. Update shifts RLS: employees can see store shifts (not just own)
DROP POLICY IF EXISTS "Employee sees own shifts" ON shifts;
CREATE POLICY "Store sees shifts" ON shifts
  FOR SELECT USING (store_id = auth_store_id());

-- 5. Update sales RLS: allow inserting sales for other referentes
DROP POLICY IF EXISTS "Employee inserts sales" ON sales;
CREATE POLICY "Employee inserts sales" ON sales
  FOR INSERT WITH CHECK (store_id = auth_store_id());

-- 6. Add created_by to sales (tracks who actually processed the sale on the device)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
-- Add movement_type if missing
ALTER TABLE sales ADD COLUMN IF NOT EXISTS movement_type text DEFAULT 'sale';
