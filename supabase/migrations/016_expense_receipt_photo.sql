-- ============================================================
-- Migration 016: Add receipt_photo_url to expenses
-- Allows employees to attach receipt photos to expenses
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT;
