-- ============================================================
-- SYNC VENDITE APPSHEET → BRAINWARE
-- High Street Store, 1-4 Giugno 2026
-- ============================================================

-- STEP 1: Cancella vendite esistenti nel range
DELETE FROM sale_items WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
    AND created_at >= '2026-06-01' AND created_at < '2026-06-05'
);
DELETE FROM sales 
WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND created_at >= '2026-06-01' AND created_at < '2026-06-05';

-- STEP 2: Inserisci tutte le vendite da AppSheet
DO $$
DECLARE
  v_store_id uuid;
  v_sale_id uuid;
  v_user_id uuid;
  v_prod_id uuid;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE name ILIKE '%high street%' LIMIT 1;

  -- === INVOICE 2 (6/1 12:02, Cash, €70, Peppe) ===
  SELECT id INTO v_user_id FROM users WHERE full_name ILIKE '%peppe%' AND store_id = v_store_id LIMIT 1;
  INSERT INTO sales (store_id, user_id, created_by, movement_type, payment_method, total, subtotal, customer_name, customer_nationality, acquisition_channel, created_at)
  VALUES (v_store_id, v_user_id, v_user_id, 'sale', 'cash', 70, 71, 'ragazzi ita', 'Ita', 'returning', '2026-06-01 12:02:30+02')
  RETURNING id INTO v_sale_id;
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = 'dry sift 5g' AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'dry sift 5g', 1, 65, 65);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = 'cartine no logo' AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'cartine no logo', 1, 3, 3);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Actitube filtri pack of 10 pcs') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Actitube filtri pack of 10 pcs', 1, 3, 3);

  -- === INVOICE 3 (6/1 13:07, Cash, €64, Peppe) ===
  INSERT INTO sales (store_id, user_id, created_by, movement_type, payment_method, total, subtotal, customer_name, customer_nationality, acquisition_channel, created_at)
  VALUES (v_store_id, v_user_id, v_user_id, 'sale', 'cash', 64, 65, 'TUNESI', 'Tunesi', 'returning', '2026-06-01 13:07:19+02')
  RETURNING id INTO v_sale_id;
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = 'dry sift 5g' AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'dry sift 5g', 1, 65, 65);

  -- === INVOICE 4 (6/1 13:08, Cash, €60, Peppe) ===
  INSERT INTO sales (store_id, user_id, created_by, movement_type, payment_method, total, subtotal, customer_name, customer_nationality, acquisition_channel, created_at)
  VALUES (v_store_id, v_user_id, v_user_id, 'sale', 'cash', 60, 60, 'GRUPPO', 'Gruppo', 'google', '2026-06-01 13:08:17+02')
  RETURNING id INTO v_sale_id;
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = 'dry sift 2g' AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'dry sift 2g', 1, 30, 30);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Lemon weed 2g') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Lemon weed 2g', 1, 25, 25);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Grinder MM') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Grinder MM', 1, 5, 5);

  -- === INVOICE 5 (6/1 13:08, POS, €36, Peppe) ===
  INSERT INTO sales (store_id, user_id, created_by, movement_type, payment_method, total, subtotal, customer_name, acquisition_channel, created_at)
  VALUES (v_store_id, v_user_id, v_user_id, 'sale', 'pos', 36, 36, NULL, 'google', '2026-06-01 13:08:17+02')
  RETURNING id INTO v_sale_id;
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('OG Kush 3G') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'OG Kush 3G', 1, 30, 30);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Cartine MM') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Cartine MM', 1, 3, 3);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Clipper Accendino') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Clipper Accendino', 1, 3, 3);

  -- === INVOICE 6 (6/1 13:12, POS, €101, Peppe) ===
  INSERT INTO sales (store_id, user_id, created_by, movement_type, payment_method, total, subtotal, customer_name, acquisition_channel, created_at)
  VALUES (v_store_id, v_user_id, v_user_id, 'sale', 'pos', 101, 98, NULL, 'google', '2026-06-01 13:12:56+02')
  RETURNING id INTO v_sale_id;
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Lemon hash 2g') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Lemon hash 2g', 1, 30, 30);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Cherry Pie 3g') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Cherry Pie 3g', 1, 30, 30);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Grinder MM') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Grinder MM', 1, 5, 5);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = 'dry sift 2g' AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'dry sift 2g', 1, 30, 30);
  SELECT id INTO v_prod_id FROM products WHERE LOWER(name) = LOWER('Clipper Accendino') AND store_id = v_store_id LIMIT 1;
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (v_sale_id, v_prod_id, 'Clipper Accendino', 1, 3, 3);

END $$;
