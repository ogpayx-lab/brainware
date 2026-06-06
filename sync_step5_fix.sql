-- Fix split invoices (rimuovi doppio conteggio cash)
UPDATE sales SET total = 48, subtotal = 48, payment_method = 'pos'
WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND created_at = '2026-06-01 20:20:37+00';

UPDATE sales SET total = 10, subtotal = 10, payment_method = 'pos'
WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND created_at = '2026-06-01 20:41:01+00';

-- Rimuovi online sales (Shopify le traccia già)
DELETE FROM sale_items WHERE sale_id IN (
  SELECT id FROM sales WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
    AND acquisition_channel = 'shopify' AND created_at >= '2026-06-01' AND created_at < '2026-06-05'
);
DELETE FROM sales WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND acquisition_channel = 'shopify' AND created_at >= '2026-06-01' AND created_at < '2026-06-05';

-- Cleanup temp tables
DROP TABLE IF EXISTS tmp_inv;
DROP TABLE IF EXISTS tmp_items;

-- Verifica finale
SELECT created_at::date as data, count(*) as vendite, sum(total) as totale
FROM sales 
WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND created_at >= '2026-06-01' AND created_at < '2026-06-05'
GROUP BY created_at::date ORDER BY data;
