-- ============================================================
-- SYNC Ricariche June 7 + June 8, 2026
-- Store: MamaMary MT High Street
-- ============================================================

-- Stock INCREMENT (ricariche = prodotti aggiunti allo store)
UPDATE products SET stock = stock + v.qty
FROM (VALUES
  -- June 7 restocks
  ('SuperSkunk 2g', 5),
  ('Lemon weed 2g', 5),
  ('Lemon weed 3g', 5),
  ('dry sift 2g', 5),
  ('Spaghetti Cheese 3g', 5),
  -- June 8 restocks
  ('Strong Cannabis Gummies MM', 5),
  ('Bob my Box', 52),
  ('Bubble Hash 2g', 10),   -- 5 + 5
  ('Lemon hash 2g', 10),    -- 5 + 5
  ('Cartine MM', 25),
  ('Mexican Strong Pre-roll', 40)
) AS v(pname, qty)
WHERE products.name ILIKE v.pname
  AND products.store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1);
