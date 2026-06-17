-- ============================================================
-- STEP 1: Check for duplicate triggers on sale_items
-- ============================================================
SELECT tgname, tgtype, proname 
FROM pg_trigger t 
JOIN pg_proc p ON t.tgfoid = p.oid 
WHERE tgrelid = 'sale_items'::regclass 
AND NOT tgisinternal;

-- ============================================================
-- STEP 2: Drop ALL triggers on sale_items and recreate clean
-- ============================================================

-- Drop any existing triggers
DROP TRIGGER IF EXISTS trg_decrement_stock ON sale_items;
DROP TRIGGER IF EXISTS trg_restore_stock ON sale_items;
DROP TRIGGER IF EXISTS trg_decrement_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS decrement_stock_trigger ON sale_items;

-- Recreate the decrement function (clean)
CREATE OR REPLACE FUNCTION decrement_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock - NEW.qty,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate SINGLE trigger for insert
CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON sale_items
FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_sale();

-- Recreate the restore function (clean)  
CREATE OR REPLACE FUNCTION restore_stock_on_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock + OLD.qty,
      updated_at = now()
  WHERE id = OLD.product_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate SINGLE trigger for delete
CREATE TRIGGER trg_restore_stock
AFTER DELETE ON sale_items
FOR EACH ROW EXECUTE FUNCTION restore_stock_on_sale_delete();

-- ============================================================
-- STEP 3: Verify — should show exactly 2 triggers
-- ============================================================
SELECT tgname, tgtype, proname 
FROM pg_trigger t 
JOIN pg_proc p ON t.tgfoid = p.oid 
WHERE tgrelid = 'sale_items'::regclass 
AND NOT tgisinternal;

-- ============================================================
-- STEP 4: Add source_warehouse_id if missing
-- ============================================================
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES warehouses(id);
