-- ============================================================
-- BrainWare v1.2 — Migration 004
-- Esegui nel SQL Editor di Supabase dopo 001, 002, 003
-- ============================================================

-- ============================================================
-- ORGANIZATIONS (multi-tenant — ogni cliente del gestionale)
-- ============================================================
create table if not exists organizations (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  slug         text not null unique,
  plan         text not null default 'trial',  -- trial, pro, enterprise
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Collega stores alle organizations
alter table stores
  add column if not exists organization_id uuid references organizations(id);

-- ============================================================
-- SUPERADMIN ROLE
-- ============================================================
alter type user_role add value if not exists 'superadmin';

-- ============================================================
-- FIDELITY CARDS
-- ============================================================
create sequence if not exists fidelity_seq start 1;

create table if not exists fidelity_cards (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id),
  card_number     text not null unique,
  customer_name   text not null,
  customer_phone  text,
  customer_email  text,
  customer_dob    date,
  customer_nationality text,
  acquisition_source text,
  notes           text,
  points          integer not null default 0,
  is_active       boolean not null default true,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists fidelity_transactions (
  id             uuid primary key default uuid_generate_v4(),
  card_id        uuid not null references fidelity_cards(id),
  sale_id        uuid references sales(id),
  points_delta   integer not null,  -- positivo = guadagno, negativo = utilizzo
  reason         text,
  created_at     timestamptz not null default now()
);

create or replace function generate_fidelity_number()
returns text as $$
begin
  return 'FC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('fidelity_seq')::text, 4, '0');
end;
$$ language plpgsql;

-- Trigger auto-numero card
create or replace function set_card_number()
returns trigger as $$
begin
  if new.card_number is null or new.card_number = '' then
    new.card_number := generate_fidelity_number();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_card_number
before insert on fidelity_cards
for each row execute function set_card_number();

-- RLS fidelity
alter table fidelity_cards enable row level security;
alter table fidelity_transactions enable row level security;

create policy "Store sees fidelity cards" on fidelity_cards
  for all using (store_id = auth_store_id());
create policy "Store sees fidelity txns" on fidelity_transactions
  for all using (
    exists (select 1 from fidelity_cards fc where fc.id = card_id and fc.store_id = auth_store_id())
  );

-- ============================================================
-- AI KNOWLEDGE BASE (configurata dall'owner, usata dal dipendente)
-- ============================================================
create type kb_item_type as enum ('faq', 'procedure', 'product_info', 'document');

create table if not exists ai_knowledge_base (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references stores(id),
  type        kb_item_type not null default 'faq',
  question    text,
  answer      text not null,
  title       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table ai_knowledge_base enable row level security;
create policy "Store sees kb" on ai_knowledge_base
  for all using (store_id = auth_store_id());

-- Seed FAQ di default
-- (verrà inserita dopo aver creato i negozi)

-- ============================================================
-- ONLINE ORDERS (POS vendita online con delivery)
-- ============================================================
create type delivery_type as enum ('delivery', 'long_distance', 'pickup');

create table if not exists online_orders (
  id                  uuid primary key default uuid_generate_v4(),
  sale_id             uuid references sales(id),
  store_id            uuid not null references stores(id),
  user_id             uuid not null references users(id),
  delivery_type       delivery_type not null default 'delivery',
  recipient_name      text not null,
  address             text not null,
  city                text,
  cap                 text,
  phone               text,
  courier             text,
  tracking_number     text,
  delivery_notes      text,
  shipping_cost       numeric(8,2) not null default 0,
  status              text not null default 'pending',
  shipped_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table online_orders enable row level security;
create policy "Store sees online orders" on online_orders
  for all using (store_id = auth_store_id());

-- ============================================================
-- FIDELITY CONFIG (per store)
-- ============================================================
alter table store_config
  add column if not exists fidelity_enabled boolean not null default true,
  add column if not exists fidelity_points_per_euro numeric(8,2) not null default 1.0,
  add column if not exists fidelity_target_per_day integer not null default 5,
  add column if not exists delivery_radius_km integer not null default 15,
  add column if not exists delivery_cost_default numeric(8,2) not null default 5.00,
  add column if not exists long_distance_cost_default numeric(8,2) not null default 9.90,
  add column if not exists expense_approval_threshold numeric(8,2) not null default 50.00;

-- ============================================================
-- PLATFORM SETTINGS (solo superadmin)
-- ============================================================
create table if not exists platform_settings (
  id                        uuid primary key default uuid_generate_v4(),
  owner_can_edit_settings   boolean not null default true,
  max_discount_pct          numeric(5,2) not null default 25.00,
  force_daily_inventory     boolean not null default false,
  transfers_enabled         boolean not null default true,
  online_sales_enabled      boolean not null default true,
  hide_system_inventory_qty boolean not null default false,
  fidelity_enabled_default  boolean not null default true,
  fidelity_points_per_euro  numeric(8,2) not null default 1.0,
  fidelity_target_per_day   integer not null default 5,
  inventory_max_attempts    integer not null default 2,
  delivery_radius_km        integer not null default 15,
  delivery_cost_default     numeric(8,2) not null default 5.00,
  long_distance_cost_default numeric(8,2) not null default 9.90,
  fcu_default               numeric(10,2) not null default 200.00,
  expense_approval_threshold numeric(8,2) not null default 50.00,
  updated_at                timestamptz not null default now()
);

-- Insert default platform settings
insert into platform_settings (id) values (uuid_generate_v4())
on conflict do nothing;

-- ============================================================
-- SUPERADMIN HELPER FUNCTION
-- ============================================================
create or replace function is_superadmin() returns boolean as $$
  select exists (
    select 1 from users where id = auth.uid() and role = 'superadmin'
  );
$$ language sql security definer;

-- Superadmin bypasses all RLS — add to existing policies
-- (superadmin can read/write everything)
create policy "Superadmin reads all stores" on stores
  for select using (is_superadmin());
create policy "Superadmin manages all stores" on stores
  for all using (is_superadmin());
create policy "Superadmin reads all users" on users
  for select using (is_superadmin());
create policy "Superadmin manages all users" on users
  for all using (is_superadmin());
create policy "Superadmin reads all sales" on sales
  for select using (is_superadmin());
create policy "Superadmin reads all organizations" on organizations
  for all using (is_superadmin());

-- Platform settings: only superadmin
alter table platform_settings enable row level security;
create policy "Superadmin manages platform" on platform_settings
  for all using (is_superadmin());

-- ============================================================
-- DEFAULT SEED: organizzazione MamaMary
-- ============================================================
insert into organizations (name, slug, plan)
values ('MamaMary', 'mamamary', 'enterprise')
on conflict (slug) do nothing;

-- Collega tutti i negozi esistenti all'org MamaMary
update stores
set organization_id = (select id from organizations where slug = 'mamamary')
where organization_id is null;
