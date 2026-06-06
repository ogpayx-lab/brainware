-- STEP 3: Delete existing sales for High Street 6/1-6/5
DO $$
DECLARE v_store_id uuid;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE name ILIKE '%high street%' LIMIT 1;
  DELETE FROM sale_items WHERE sale_id IN (
    SELECT id FROM sales WHERE store_id = v_store_id AND created_at >= '2026-06-01' AND created_at < '2026-06-05'
  );
  DELETE FROM sales WHERE store_id = v_store_id AND created_at >= '2026-06-01' AND created_at < '2026-06-05';
END $$;

-- STEP 4: Insert all sales and items
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
    -- Map referente to user_id
    v_user_id := CASE inv.ref
      WHEN 'Peppe' THEN '7add32b7-4803-41d7-b6a8-6e7df62a617e'::uuid
      WHEN 'Andrea' THEN '3741ec04-5d49-4e8b-8eea-4ee71eb8e41e'::uuid
      WHEN 'Lorenzo' THEN 'c79bd98c-980f-4d8e-91e6-0bd246d8dbb8'::uuid
      WHEN 'Adam' THEN 'd18168bb-c296-47d1-b379-1db28f4a9f3e'::uuid
      ELSE '3741ec04-5d49-4e8b-8eea-4ee71eb8e41e'::uuid -- default Andrea
    END;

    -- Insert sale
    INSERT INTO sales (
      store_id, user_id, created_by, movement_type, payment_method, 
      total, subtotal, customer_name, acquisition_channel, 
      split_cash_amount, created_at
    ) VALUES (
      v_store_id, v_user_id, v_user_id, inv.mv::movement_type, inv.pay::payment_method,
      inv.total, inv.total, inv.cust, inv.ch::acquisition_channel,
      CASE WHEN inv.n = 8 THEN 20 WHEN inv.n = 22 THEN 20 ELSE NULL END,
      inv.ts
    ) RETURNING id INTO v_sale_id;

    -- Insert items for this invoice
    FOR itm IN SELECT * FROM tmp_items WHERE n = inv.n LOOP
      SELECT id INTO v_prod_id FROM products 
      WHERE LOWER(name) = LOWER(itm.pname) AND store_id = v_store_id LIMIT 1;
      
      INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total)
      VALUES (v_sale_id, v_prod_id, itm.pname, itm.qty, itm.price, itm.price * itm.qty);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Done! Inserted % sales', (SELECT count(*) FROM tmp_inv);
END $$;

