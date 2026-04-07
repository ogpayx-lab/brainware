-- ============================================
-- BrainWare Warehouse Management System
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. WAREHOUSES TABLE
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'secondary' CHECK (type IN ('central', 'secondary')),
  address TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. WAREHOUSE STOCK TABLE
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category TEXT DEFAULT 'flowers',
  sku TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pz',
  cost_per_unit NUMERIC(10,2) DEFAULT 0,
  sell_price NUMERIC(10,2) DEFAULT 0,
  stock_alert INTEGER DEFAULT 5,
  is_bulk BOOLEAN DEFAULT false,
  bulk_unit TEXT, -- 'kg', 'g', 'litri'
  bulk_qty NUMERIC(10,3) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. WAREHOUSE MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS warehouse_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES warehouse_stock(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'transfer_out', 'transfer_in', 'adjustment', 'damaged', 'return')),
  qty INTEGER NOT NULL,
  cost_per_unit NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  reference_type TEXT, -- 'purchase', 'store_restock', 'warehouse_transfer', 'manual', 'damaged'
  destination_type TEXT, -- 'store', 'warehouse', 'vending', null
  destination_id UUID,
  destination_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS POLICIES
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_movements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (org-level filtering done in app)
CREATE POLICY "warehouses_all" ON warehouses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "warehouse_stock_all" ON warehouse_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "warehouse_movements_all" ON warehouse_movements FOR ALL USING (true) WITH CHECK (true);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_movements_warehouse ON warehouse_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_movements_created ON warehouse_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouses_org ON warehouses(organization_id);
