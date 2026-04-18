-- ============================================================
-- INVENTORY AUDIT SYSTEM
-- Adds time-based inventory count scheduling per store,
-- manual open/close control, and discrepancy resolution tracking
-- ============================================================

-- Store-level inventory count configuration
ALTER TABLE stores ADD COLUMN IF NOT EXISTS 
  inventory_count_opens_at TIME DEFAULT '18:00';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS 
  inventory_manually_opened BOOLEAN DEFAULT false;

-- Resolution tracking for inventory count items
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  resolved BOOLEAN DEFAULT false;
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  resolution_type TEXT;
  -- Values: 'swap', 'qty_error', 'void_not_restored', 'starting_point',
  --         'restock_missing', 'manual_correction', 'count_accepted', 'system_kept'
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  resolution_notes TEXT;
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  resolved_by UUID REFERENCES users(id);
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  resolved_at TIMESTAMPTZ;
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  corrected_qty INTEGER;
ALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS 
  stock_corrected BOOLEAN DEFAULT false;
