-- Fix RLS for promo_codes table
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage promo codes" ON promo_codes FOR ALL USING (store_id IN (SELECT store_id FROM users WHERE id = auth.uid())) WITH CHECK (store_id IN (SELECT store_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Employees can read promo codes" ON promo_codes FOR SELECT USING (store_id IN (SELECT store_id FROM users WHERE id = auth.uid()));
