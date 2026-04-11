-- ============================================================
-- 008: Transfer Receipt Verification
-- Adds status tracking and transfer linking to stock_requests
-- ============================================================

-- Add status and transfer_id to stock_requests
ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'owner_review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS transfer_id uuid;

-- Add qty_sent to stock_request_items (qty sent by transfer, for comparison)
ALTER TABLE stock_request_items
  ADD COLUMN IF NOT EXISTS qty_sent integer;

-- Update existing rows to 'approved' (legacy data)
UPDATE stock_requests SET status = 'approved' WHERE approved_at IS NOT NULL;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_store ON stock_requests(store_id);
