-- ============================================================
-- SET INVENTORY — Conteggio 9 Giugno 2026
-- Store: MamaMary MT High Street
-- Imposta stock ai valori esatti del conteggio
-- ============================================================

UPDATE products SET stock = v.qty
FROM (VALUES
  -- Accessories
  ('Accendino MM', 52),
  ('Actitube filtri pack of 10 pcs', 4),
  ('Bob my Box', 48),
  ('Box da 3 Pre-roll', 30),
  ('cartine no logo', 57),
  ('Clipper Accendino', 18),
  ('Cyclones Hemp cones (blunt)', 58),
  ('Grinder Card', 6),
  ('Grinder MM', 3),
  ('Kit Pipe + Grinder', 9),
  ('Mexican Strong Pre-roll', 39),
  ('Hemp Cones + Glass Tip', 4),
  ('Cartine MM', 28),
  -- Flowers
  ('Amnesia 2g', 7),
  ('Amnesia 3g', 2),
  ('Amnesia 5g', 1),
  ('Cherry Pie 2g', 6),
  ('Cherry Pie 3g', 6),
  ('Cherry Pie 5g', 5),
  ('Gelato 2g', 4),
  ('Gelato 3g', 5),
  ('Gelato 5g', 2),
  ('Lemon weed 2g', 7),
  ('Lemon weed 3g', 5),
  ('Lemon weed 5g', 7),
  ('OG Kush 2G', 6),
  ('OG Kush 3G', 4),
  ('OG Kush 5G', 2),
  ('Runtz 2g', 6),
  ('Runtz 3g', 5),
  ('Runtz 5g', 5),
  ('Sour Diesel 2g', 7),
  ('Sour Diesel 3g', 6),
  ('Sour Diesel 5g', 5),
  ('Spaghetti Cheese 2g', 7),
  ('Spaghetti Cheese 3g', 7),
  ('Spaghetti Cheese 5g', 7),
  ('SuperSkunk 2g', 9),
  ('SuperSkunk 3g', 3),
  ('SuperSkunk 5g', 3),
  ('Mango 2g', 6),
  ('Mango 3g', 3),
  ('Mango 5g', 5),
  ('Single Pre Roll', 28),
  -- Food
  ('Euphory-E (Happy Caps) DISPLAY', 11),
  ('Heavenly-E (Happy Caps) DISPLAY', 3),
  ('Party-E (Happy Caps) DISPLAY', 14),
  ('sex-e (Happy Caps) DISPLAY', 8),
  ('space-e (Happy Caps) DISPLAY', 12),
  ('Strong Cannabis Gummies MM', 5),
  ('THC Shots', 15),
  ('Trance-E (Happy Caps) DISPLAY', 3),
  -- Hashish
  ('Bubble Hash 10g', 3),
  ('Bubble Hash 2g', 2),
  ('Bubble Hash 5g', 3),
  ('dry sift 10g', 4),
  ('dry sift 2g', 4),
  ('dry sift 5g', 4),
  ('Lemon hash 10g', 2),
  ('Lemon hash 2g', 3),
  ('Lemon hash 5g', 5),
  -- Oils
  ('OIL hemp 10%', 7),
  ('OIL hemp 20%', 10),
  ('OIL hemp 30%', 10),
  ('OIL Lemon 10%', 9),
  ('OIL orange 10%', 5),
  -- Pet
  ('Plants for pet CBD Calming Balm', 1),
  ('Plants for pet CBD Fortifying Balm', 4),
  ('Plants for pet CBD Repair Balm S', 4),
  -- Seeds
  ('Semi Amnesia AUTO pack 3', 8),
  ('Semi Banana Punch AUTO pack 3', 9),
  ('semi Cookies FEM pack 3', 6),
  ('Semi Critical Kush auto pack 3', 10),
  ('Semi Dosidos AUTO pack 3', 4),
  ('Semi Gelato FAST pack 3', 6),
  ('Semi Lemon Haze fast pack 3', 8),
  ('Semi Mimosa FAST pack 3', 9),
  ('Semi OG Kush FEM pack 3', 10),
  ('Semi RUNTZ FEM pack 3', 8),
  ('Semi Strawberry OG auto pack 3', 10),
  ('Semi Super Skunk FAST pack 3', 8),
  -- Vape
  ('Vape Disposable 2ml', 16),
  ('TeslaBar', 7)
) AS v(pname, qty)
WHERE products.name ILIKE v.pname
  AND products.store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1);
