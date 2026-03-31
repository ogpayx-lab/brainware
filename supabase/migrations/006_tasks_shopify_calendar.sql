-- ============================================================
-- BrainWare — Migration 006: Tasks, Shift Requests, Shopify
-- Esegui nel SQL Editor di Supabase
-- ============================================================

-- =====================
-- TASKS
-- =====================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  title text not null,
  description text,
  priority text default 'media' check (priority in ('alta','media','bassa')),
  due_date date,
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  completed boolean default false,
  completed_at timestamptz,
  completed_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);
alter table tasks enable row level security;
create policy "Store members see tasks" on tasks for select using (store_id = auth_store_id());
create policy "Store members manage tasks" on tasks for all using (store_id = auth_store_id());

-- =====================
-- SHIFT DAY REQUESTS (richieste giorni liberi)
-- =====================
create table if not exists shift_day_requests (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  request_date date not null,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table shift_day_requests enable row level security;
create policy "Employee sees own requests" on shift_day_requests for select using (user_id = auth.uid() or store_id = auth_store_id());
create policy "Employee creates requests" on shift_day_requests for insert with check (user_id = auth.uid());
create policy "Owner manages requests" on shift_day_requests for update using (store_id = auth_store_id());

-- =====================
-- SHOPIFY CONFIG (per store)
-- =====================
create table if not exists shopify_config (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade unique,
  shopify_domain text not null,         -- es. mio-negozio.myshopify.com
  access_token text,                    -- Shopify Admin API token
  sync_enabled boolean default false,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);
alter table shopify_config enable row level security;
create policy "Owner manages shopify config" on shopify_config for all using (store_id = auth_store_id());

-- =====================
-- VERIFICA
-- =====================
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('tasks','shift_day_requests','shopify_config');
