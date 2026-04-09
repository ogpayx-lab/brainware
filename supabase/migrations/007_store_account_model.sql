-- ============================================================
-- Migration: Store Account Model
-- Employees are profiles (no auth), only store has auth account
-- ============================================================

-- Drop FK constraint on users.id so we can create employee profiles without auth
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Allow users.id to accept any UUID (not just auth.users references)
-- Existing auth-linked users still work fine
