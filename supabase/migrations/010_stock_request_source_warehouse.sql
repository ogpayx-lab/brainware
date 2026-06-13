-- Add source_warehouse_id to stock_requests for warehouse assignment tracking
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES warehouses(id);
