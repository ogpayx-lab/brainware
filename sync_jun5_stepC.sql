-- SYNC VENDITE 5 GIUGNO - Step C: Cancella vecchi dati, inserisci, DECREMENTA STOCK

-- Delete existing 6/5 sales
DO $$
DECLARE v_store_id uuid;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE name ILIKE '%high street%' LIMIT 1;
  DELETE FROM sale_items WHERE sale_id IN (
    SELECT id FROM sales WHERE store_id = v_store_id AND created_at >= '2026-06-05' AND created_at < '2026-06-06'
  );
  DELETE FROM sales WHERE store_id = v_store_id AND created_at >= '2026-06-05' AND created_at < '2026-06-06';
END $$;

-- Insert all sales, items, AND decrement stock
DO $$
DECLARE
  v_store_id uuid;
  v_sale_id uuid;
  v_user_id uuid;
  v_prod_id uuid;
  inv record;
  itm record;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE name ILIKE '%high street%' LIMIT 1;

  FOR inv IN SELECT * FROM tmp_inv ORDER BY n LOOP
    v_user_id := 'c79bd98c-980f-4d8e-91e6-0bd246d8dbb8'::uuid; -- Lorenzo (tutti i turni del 5/6)

    INSERT INTO sales (
      store_id, user_id, created_by, movement_type, payment_method, 
      total, subtotal, customer_name, acquisition_channel, created_at
    ) VALUES (
      v_store_id, v_user_id, v_user_id, inv.mv::movement_type, inv.pay::payment_method,
      inv.total, inv.total, inv.cust, inv.ch::acquisition_channel, inv.ts
    ) RETURNING id INTO v_sale_id;

    FOR itm IN SELECT * FROM tmp_items WHERE n = inv.n LOOP
      SELECT id INTO v_prod_id FROM products 
      WHERE LOWER(name) = LOWER(itm.pname) AND store_id = v_store_id LIMIT 1;
      
      INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total)
      VALUES (v_sale_id, v_prod_id, itm.pname, itm.qty, itm.price, itm.price * itm.qty);

      -- DECREMENTA STOCK
      IF v_prod_id IS NOT NULL THEN
        UPDATE products SET stock = stock - itm.qty WHERE id = v_prod_id;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Done! Inserted % sales with stock decrement', (SELECT count(*) FROM tmp_inv);
END $$;

-- Verifica
SELECT created_at::date as data, count(*) as vendite, sum(total) as totale,
  sum(CASE WHEN payment_method='cash' THEN total ELSE 0 END) as cash,
  sum(CASE WHEN payment_method='pos' THEN total ELSE 0 END) as pos,
  sum(CASE WHEN movement_type='autoconsumo' THEN total ELSE 0 END) as autoconsumo
FROM sales 
WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND created_at >= '2026-06-05' AND created_at < '2026-06-06'
GROUP BY created_at::date ORDER BY data;

-- Cleanup
DROP TABLE IF EXISTS tmp_inv;
DROP TABLE IF EXISTS tmp_items;
