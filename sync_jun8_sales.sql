-- ============================================================
-- SYNC June 8, 2026 — Sales from AppSheet (INV 222–256)
-- Store: MamaMary MT High Street
-- Employee: Lorenzo
-- ============================================================

-- Step 1: Get store_id and user_id
DO $$
DECLARE
  sid uuid;
  uid uuid;
  shid uuid;
BEGIN
  SELECT id INTO sid FROM stores WHERE name ILIKE '%high street%' LIMIT 1;
  SELECT id INTO uid FROM users WHERE full_name ILIKE '%Lorenzo%' AND store_id = sid LIMIT 1;
  SELECT id INTO shid FROM shifts WHERE store_id = sid AND status = 'open'
    ORDER BY created_at DESC LIMIT 1;

  -- ════════════════════════════════════════
  -- INSERT SALES (35 sales, INV 222–256)
  -- ════════════════════════════════════════
  INSERT INTO sales (id, store_id, user_id, shift_id, total, subtotal, payment_method, movement_type,
    customer_name, customer_nationality, acquisition_channel, invoice_number, created_at)
  VALUES
  -- INV 222 - Autoconsumo
  (gen_random_uuid(), sid, uid, shid, 65, 65, 'cash', 'autoconsumo', 'Autoconsumo Lorenzo', NULL, NULL, '#INV-0222', '2026-06-08T11:27:35'),
  -- INV 223
  (gen_random_uuid(), sid, uid, shid, 125, 125, 'cash', 'sale', 'Tedeschi', NULL, 'walk-in', '#INV-0223', '2026-06-08T11:49:47'),
  -- INV 224
  (gen_random_uuid(), sid, uid, shid, 190, 190, 'pos', 'sale', 'Uk', NULL, 'walk-in', '#INV-0224', '2026-06-08T11:52:16'),
  -- INV 225
  (gen_random_uuid(), sid, uid, shid, 25, 25, 'cash', 'sale', 'Ita', 'Italia', 'google', '#INV-0225', '2026-06-08T11:53:04'),
  -- INV 226
  (gen_random_uuid(), sid, uid, shid, 60, 60, 'cash', 'sale', 'Serbi', NULL, 'walk-in', '#INV-0226', '2026-06-08T12:19:26'),
  -- INV 227
  (gen_random_uuid(), sid, uid, shid, 160, 160, 'cash', 'sale', 'Local', NULL, 'walk-in', '#INV-0227', '2026-06-08T13:04:30'),
  -- INV 228
  (gen_random_uuid(), sid, uid, shid, 133, 133, 'pos', 'sale', 'Usa', NULL, 'walk-in', '#INV-0228', '2026-06-08T13:37:42'),
  -- INV 229
  (gen_random_uuid(), sid, uid, shid, 55, 55, 'pos', 'sale', 'Usa', NULL, 'walk-in', '#INV-0229', '2026-06-08T14:57:44'),
  -- INV 230
  (gen_random_uuid(), sid, uid, shid, 65, 65, 'pos', 'sale', 'Polacco', NULL, 'walk-in', '#INV-0230', '2026-06-08T15:01:22'),
  -- INV 231
  (gen_random_uuid(), sid, uid, shid, 60, 60, 'cash', 'sale', 'Albanese', NULL, 'walk-in', '#INV-0231', '2026-06-08T15:02:30'),
  -- INV 232
  (gen_random_uuid(), sid, uid, shid, 30, 30, 'pos', 'sale', 'Lorenzo', NULL, 'walk-in', '#INV-0232', '2026-06-08T15:03:34'),
  -- INV 233
  (gen_random_uuid(), sid, uid, shid, 200, 200, 'pos', 'sale', 'Usa', NULL, 'walk-in', '#INV-0233', '2026-06-08T15:53:37'),
  -- INV 234
  (gen_random_uuid(), sid, uid, shid, 25, 25, 'pos', 'sale', 'Georgia', NULL, 'google', '#INV-0234', '2026-06-08T15:54:59'),
  -- INV 235
  (gen_random_uuid(), sid, uid, shid, 20, 20, 'pos', 'sale', 'Local', NULL, 'walk-in', '#INV-0235', '2026-06-08T17:26:56'),
  -- INV 236
  (gen_random_uuid(), sid, uid, shid, 60, 60, 'pos', 'sale', 'Spagnolo', NULL, 'walk-in', '#INV-0236', '2026-06-08T18:02:25'),
  -- INV 237
  (gen_random_uuid(), sid, uid, shid, 25, 25, 'pos', 'sale', 'Irlandese', NULL, 'google', '#INV-0237', '2026-06-08T18:11:15'),
  -- INV 238
  (gen_random_uuid(), sid, uid, shid, 100, 100, 'cash', 'sale', 'Qatar', NULL, 'google', '#INV-0238', '2026-06-08T18:25:32'),
  -- INV 239
  (gen_random_uuid(), sid, uid, shid, 130, 130, 'pos', 'sale', 'Local', NULL, 'walk-in', '#INV-0239', '2026-06-08T18:26:30'),
  -- INV 240
  (gen_random_uuid(), sid, uid, shid, 60, 60, 'pos', 'sale', 'Egiziani', NULL, 'walk-in', '#INV-0240', '2026-06-08T18:35:16'),
  -- INV 241
  (gen_random_uuid(), sid, uid, shid, 50, 50, 'pos', 'sale', 'Brasiliani', NULL, 'walk-in', '#INV-0241', '2026-06-08T19:12:26'),
  -- INV 242
  (gen_random_uuid(), sid, uid, shid, 105, 105, 'pos', 'sale', 'Canadese', NULL, 'walk-in', '#INV-0242', '2026-06-08T19:37:58'),
  -- INV 243
  (gen_random_uuid(), sid, uid, shid, 100, 100, 'pos', 'sale', 'Local', NULL, 'walk-in', '#INV-0243', '2026-06-08T19:43:53'),
  -- INV 244
  (gen_random_uuid(), sid, uid, shid, 50, 50, 'pos', 'sale', 'Olandese', NULL, 'walk-in', '#INV-0244', '2026-06-08T19:46:48'),
  -- INV 245
  (gen_random_uuid(), sid, uid, shid, 50, 50, 'cash', 'sale', 'Argentini', NULL, 'walk-in', '#INV-0245', '2026-06-08T20:25:55'),
  -- INV 246
  (gen_random_uuid(), sid, uid, shid, 25, 25, 'pos', 'sale', 'Honk kong', NULL, 'google', '#INV-0246', '2026-06-08T20:27:16'),
  -- INV 247
  (gen_random_uuid(), sid, uid, shid, 30, 30, 'cash', 'sale', 'Local', NULL, 'walk-in', '#INV-0247', '2026-06-08T20:54:15'),
  -- INV 248
  (gen_random_uuid(), sid, uid, shid, 30, 30, 'pos', 'sale', 'Polacchi', NULL, 'google', '#INV-0248', '2026-06-08T21:04:59'),
  -- INV 249
  (gen_random_uuid(), sid, uid, shid, 150, 150, 'cash', 'sale', 'Greco', NULL, 'walk-in', '#INV-0249', '2026-06-08T22:07:37'),
  -- INV 250
  (gen_random_uuid(), sid, uid, shid, 30, 30, 'cash', 'sale', 'Local', NULL, 'walk-in', '#INV-0250', '2026-06-08T22:08:28'),
  -- INV 251
  (gen_random_uuid(), sid, uid, shid, 30, 30, 'cash', 'sale', 'Spagnolo', NULL, 'google', '#INV-0251', '2026-06-08T22:10:29'),
  -- INV 252 (split: 50 pos + 5 cash based on "Tot pos 50€" vs total 55)
  (gen_random_uuid(), sid, uid, shid, 55, 55, 'split', 'sale', 'Scozzese', NULL, 'walk-in', '#INV-0252', '2026-06-08T22:11:34'),
  -- INV 253 (split: 65 cash + 65 pos based on "Tot cash 65€" vs total 130)
  (gen_random_uuid(), sid, uid, shid, 130, 130, 'split', 'sale', 'Adam', NULL, 'walk-in', '#INV-0253', '2026-06-08T22:13:43'),
  -- INV 254
  (gen_random_uuid(), sid, uid, shid, 27, 27, 'pos', 'sale', 'Uk', NULL, 'google', '#INV-0254', '2026-06-08T22:14:32'),
  -- INV 255
  (gen_random_uuid(), sid, uid, shid, 30, 30, 'pos', 'sale', 'Egiziano', NULL, 'walk-in', '#INV-0255', '2026-06-08T22:15:03'),
  -- INV 256
  (gen_random_uuid(), sid, uid, shid, 18, 18, 'pos', 'sale', 'Uk', NULL, 'google', '#INV-0256', '2026-06-08T22:57:22');

  -- Set split_cash_amount for split payments
  UPDATE sales SET split_cash_amount = 5 WHERE invoice_number = '#INV-0252' AND store_id = sid;
  UPDATE sales SET split_cash_amount = 65 WHERE invoice_number = '#INV-0253' AND store_id = sid;

END $$;

-- ════════════════════════════════════════
-- Step 2: INSERT SALE_ITEMS (link items to sales by invoice)
-- ════════════════════════════════════════
INSERT INTO sale_items (id, sale_id, product_id, product_name, qty, unit_price, line_total)
SELECT gen_random_uuid(), s.id, p.id, v.pname, v.qty, v.price, v.price * v.qty
FROM (VALUES
  -- INV 222
  ('#INV-0222', 'Bubble Hash 5g', 1, 65),
  -- INV 223
  ('#INV-0223', 'Mexican Strong Pre-roll', 1, 25),
  ('#INV-0223', 'Amnesia 5g', 3, 50),
  ('#INV-0223', 'Actitube filtri pack of 10 pcs', 2, 3),
  ('#INV-0223', 'Bob my Box', 1, 5),
  -- INV 224
  ('#INV-0224', 'Gelato 3g', 1, 30),
  ('#INV-0224', 'SuperSkunk 3g', 1, 30),
  ('#INV-0224', 'Bubble Hash 5g', 1, 65),
  ('#INV-0224', 'Lemon hash 5g', 1, 65),
  ('#INV-0224', 'Cartine MM', 1, 3),
  -- INV 225
  ('#INV-0225', 'Mexican Strong Pre-roll', 1, 25),
  -- INV 226
  ('#INV-0226', 'Lemon weed 2g', 1, 25),
  ('#INV-0226', 'Lemon hash 2g', 1, 30),
  ('#INV-0226', 'Bob my Box', 1, 5),
  ('#INV-0226', 'Grinder MM', 1, 5),
  -- INV 227
  ('#INV-0227', 'Lemon hash 2g', 1, 30),
  ('#INV-0227', 'dry sift 10g', 1, 130),
  -- INV 228
  ('#INV-0228', 'Vape Disposable 2ml', 1, 100),
  ('#INV-0228', 'Actitube filtri pack of 10 pcs', 1, 3),
  ('#INV-0228', 'Grinder MM', 1, 5),
  ('#INV-0228', 'Lemon hash 2g', 1, 30),
  -- INV 229
  ('#INV-0229', 'Bob my Box', 1, 5),
  ('#INV-0229', 'Spaghetti Cheese 3g', 1, 30),
  ('#INV-0229', 'Bubble Hash 2g', 1, 30),
  -- INV 230
  ('#INV-0230', 'dry sift 5g', 1, 65),
  -- INV 231
  ('#INV-0231', 'Bubble Hash 2g', 1, 30),
  ('#INV-0231', 'Lemon hash 2g', 1, 30),
  -- INV 232
  ('#INV-0232', 'Lemon hash 2g', 1, 30),
  -- INV 233
  ('#INV-0233', 'Vape Disposable 2ml', 2, 100),
  ('#INV-0233', 'Cherry Pie 2g', 1, 25),
  ('#INV-0233', 'Lemon hash 2g', 1, 30),
  ('#INV-0233', 'Grinder Card', 1, 8),
  -- INV 234
  ('#INV-0234', 'Mexican Strong Pre-roll', 1, 25),
  -- INV 235
  ('#INV-0235', 'THC Shots', 2, 15),
  -- INV 236
  ('#INV-0236', 'Lemon hash 2g', 1, 30),
  ('#INV-0236', 'SuperSkunk 3g', 1, 30),
  -- INV 237
  ('#INV-0237', 'Mexican Strong Pre-roll', 1, 25),
  -- INV 238
  ('#INV-0238', 'Vape Disposable 2ml', 1, 100),
  -- INV 239
  ('#INV-0239', 'Lemon hash 10g', 1, 130),
  -- INV 240
  ('#INV-0240', 'Lemon hash 2g', 1, 30),
  ('#INV-0240', 'Lemon weed 2g', 1, 25),
  ('#INV-0240', 'Grinder MM', 1, 5),
  ('#INV-0240', 'Bob my Box', 1, 5),
  -- INV 241
  ('#INV-0241', 'Lemon weed 2g', 1, 25),
  ('#INV-0241', 'Lemon hash 2g', 1, 30),
  -- INV 242
  ('#INV-0242', 'Box da 3 Pre-roll', 2, 30),
  ('#INV-0242', 'Mexican Strong Pre-roll', 1, 25),
  ('#INV-0242', 'Bubble Hash 2g', 1, 30),
  -- INV 243
  ('#INV-0243', 'Cherry Pie 5g', 3, 50),
  ('#INV-0243', 'Lemon hash 2g', 1, 30),
  -- INV 244
  ('#INV-0244', 'Amnesia 2g', 1, 25),
  -- INV 245
  ('#INV-0245', 'Lemon hash 2g', 1, 30),
  ('#INV-0245', 'Cherry Pie 2g', 1, 25),
  -- INV 246
  ('#INV-0246', 'Mexican Strong Pre-roll', 1, 25),
  -- INV 247
  ('#INV-0247', 'Bubble Hash 2g', 1, 30),
  -- INV 248
  ('#INV-0248', 'Lemon hash 2g', 1, 30),
  -- INV 249
  ('#INV-0249', 'OG Kush 5G', 1, 50),
  ('#INV-0249', 'Lemon weed 5g', 1, 50),
  ('#INV-0249', 'Bubble Hash 2g', 1, 30),
  ('#INV-0249', 'Bubble Hash 2g', 1, 30),
  -- INV 250
  ('#INV-0250', 'Bubble Hash 2g', 1, 30),
  -- INV 251
  ('#INV-0251', 'Bubble Hash 2g', 1, 30),
  -- INV 252
  ('#INV-0252', 'Bubble Hash 2g', 1, 30),
  ('#INV-0252', 'Cherry Pie 2g', 1, 25),
  -- INV 253
  ('#INV-0253', 'Bubble Hash 10g', 1, 130),
  -- INV 254
  ('#INV-0254', 'Mexican Strong Pre-roll', 1, 25),
  ('#INV-0254', 'Accendino MM', 1, 2),
  -- INV 255
  ('#INV-0255', 'Bubble Hash 2g', 1, 30),
  -- INV 256
  ('#INV-0256', 'Single Pre Roll', 1, 15),
  ('#INV-0256', 'Clipper Accendino', 1, 3)
) AS v(inv, pname, qty, price)
JOIN sales s ON s.invoice_number = v.inv
  AND s.store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
LEFT JOIN products p ON p.name ILIKE v.pname
  AND p.store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1);

-- ════════════════════════════════════════
-- Step 3: DECREMENT STOCK for all items sold
-- ════════════════════════════════════════
UPDATE products SET stock = stock - v.total_qty
FROM (VALUES
  ('Bubble Hash 5g', 2),
  ('Bubble Hash 2g', 10),
  ('Bubble Hash 10g', 1),
  ('Mexican Strong Pre-roll', 7),
  ('Amnesia 5g', 3),
  ('Amnesia 2g', 1),
  ('Actitube filtri pack of 10 pcs', 3),
  ('Bob my Box', 4),
  ('Gelato 3g', 1),
  ('SuperSkunk 3g', 3),
  ('Lemon hash 5g', 1),
  ('Lemon hash 2g', 15),
  ('Lemon hash 10g', 1),
  ('Lemon weed 2g', 3),
  ('Lemon weed 5g', 1),
  ('Cartine MM', 1),
  ('Grinder MM', 3),
  ('Grinder Card', 1),
  ('dry sift 10g', 1),
  ('dry sift 5g', 1),
  ('Vape Disposable 2ml', 4),
  ('Spaghetti Cheese 3g', 1),
  ('Cherry Pie 2g', 3),
  ('Cherry Pie 5g', 3),
  ('THC Shots', 2),
  ('Box da 3 Pre-roll', 2),
  ('OG Kush 5G', 1),
  ('Single Pre Roll', 1),
  ('Clipper Accendino', 1),
  ('Accendino MM', 1)
) AS v(pname, total_qty)
WHERE products.name ILIKE v.pname
  AND products.store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1);
