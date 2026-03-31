-- ============================================================
-- MamaMary Retail Management System — Supabase Schema
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fuzzy product search

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('owner', 'employee');
create type shift_period as enum ('morning', 'evening');
create type shift_status as enum ('open', 'closed');
create type payment_method as enum ('cash', 'pos', 'other');
create type product_category as enum ('flowers', 'hashish', 'oils', 'edibles', 'accessories');
create type acquisition_channel as enum ('walk-in', 'social', 'google', 'referral', 'other');
create type transfer_status as enum ('pending', 'in_transit', 'completed', 'cancelled');
create type inventory_status as enum ('pending', 'match', 'mismatch', 'escalated');
create type maintenance_frequency as enum ('daily', 'weekly', 'monthly');

-- ============================================================
-- STORES
-- ============================================================
create table stores (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text,
  city        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  store_id    uuid references stores(id),
  full_name   text not null,
  role        user_role not null default 'employee',
  hired_at    date,
  is_active   boolean not null default true,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- BONUS CONFIG (formula fissa ma modificabile in futuro)
-- ============================================================
create table bonus_config (
  id                    uuid primary key default uuid_generate_v4(),
  store_id              uuid references stores(id) on delete cascade,
  sales_commission_pct  numeric(5,4) not null default 0.01,   -- 1%
  hours_bonus_amount    numeric(8,2) not null default 5.00,    -- €5 per shift
  hours_bonus_threshold integer not null default 8,            -- 8h per shift
  avg_sale_threshold    numeric(8,2) not null default 40.00,   -- avg > €40
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(store_id)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table products (
  id           uuid primary key default uuid_generate_v4(),
  store_id     uuid references stores(id) on delete cascade,
  name         text not null,
  category     product_category not null,
  price        numeric(10,2) not null,               -- selling price (per unit/gram)
  cost         numeric(10,2),                         -- purchase cost (optional, for margin)
  unit         text not null default 'g',             -- 'g', 'ml', 'pz'
  barcode      text,                                  -- internal MamaMary QR/barcode
  stock        integer not null default 0,
  stock_alert  integer not null default 5,            -- low stock threshold
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on products using gin(name gin_trgm_ops); -- fuzzy search

-- ============================================================
-- SHIFTS
-- ============================================================
create table shifts (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id),
  user_id         uuid not null references users(id),
  period          shift_period not null,
  status          shift_status not null default 'open',
  fce             numeric(10,2) not null default 0,   -- Fondo Cassa Entrata
  fcu             numeric(10,2),                       -- Fondo Cassa Uscita (on close)
  deposit_actual  numeric(10,2),                       -- deposito effettivo (on close)
  variance_reason text,                                -- motivo varianza cassa
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- SALES
-- ============================================================
create table sales (
  id                  uuid primary key default uuid_generate_v4(),
  shift_id            uuid not null references shifts(id),
  store_id            uuid not null references stores(id),
  user_id             uuid not null references users(id),
  payment_method      payment_method not null,
  subtotal            numeric(10,2) not null,
  discount_amount     numeric(10,2) not null default 0,
  discount_pct        numeric(5,2) not null default 0,
  total               numeric(10,2) not null,
  cash_received       numeric(10,2),                   -- cash only
  cash_change         numeric(10,2),                   -- cash only
  pos_reference       text,                            -- POS terminal ref #
  customer_name       text,
  customer_nationality text,
  acquisition_channel acquisition_channel default 'walk-in',
  customer_email      text,
  discount_reason     text,
  discount_approved   boolean default false,
  invoice_number      text unique,                     -- #INV-XXXX
  created_at          timestamptz not null default now()
);

-- ============================================================
-- SALE ITEMS
-- ============================================================
create table sale_items (
  id          uuid primary key default uuid_generate_v4(),
  sale_id     uuid not null references sales(id) on delete cascade,
  product_id  uuid not null references products(id),
  product_name text not null,                          -- snapshot
  qty         numeric(10,3) not null,                  -- grams/units
  unit_price  numeric(10,2) not null,                  -- snapshot
  line_total  numeric(10,2) not null
);

-- ============================================================
-- EXPENSES
-- ============================================================
create table expenses (
  id          uuid primary key default uuid_generate_v4(),
  shift_id    uuid not null references shifts(id),
  store_id    uuid not null references stores(id),
  user_id     uuid not null references users(id),
  amount      numeric(10,2) not null,
  description text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- STOCK REQUESTS (Ricarica Stock)
-- ============================================================
create table stock_requests (
  id          uuid primary key default uuid_generate_v4(),
  shift_id    uuid not null references shifts(id),
  store_id    uuid not null references stores(id),
  user_id     uuid not null references users(id),
  notes       text,
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);

create table stock_request_items (
  id               uuid primary key default uuid_generate_v4(),
  stock_request_id uuid not null references stock_requests(id) on delete cascade,
  product_id       uuid not null references products(id),
  product_name     text not null,
  stock_before     integer not null,
  qty_requested    integer not null,
  qty_delivered    integer,
  cost_per_unit    numeric(10,2)                        -- per margin tracking
);

-- ============================================================
-- INVENTORY COUNTS
-- ============================================================
create table inventory_counts (
  id          uuid primary key default uuid_generate_v4(),
  shift_id    uuid not null references shifts(id),
  store_id    uuid not null references stores(id),
  user_id     uuid not null references users(id),
  category    product_category,                         -- null = all
  finalized   boolean not null default false,
  created_at  timestamptz not null default now(),
  finalized_at timestamptz
);

create table inventory_count_items (
  id                  uuid primary key default uuid_generate_v4(),
  inventory_count_id  uuid not null references inventory_counts(id) on delete cascade,
  product_id          uuid not null references products(id),
  product_name        text not null,
  system_qty          integer not null,
  counted_qty         integer,
  status              inventory_status not null default 'pending',
  mismatch_reason     text,
  attempt_count       integer not null default 0,
  max_attempts        integer not null default 2,
  escalated_to        uuid references users(id)
);

-- ============================================================
-- MAINTENANCE TASKS
-- ============================================================
create table maintenance_templates (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid references stores(id),              -- null = global
  title       text not null,
  frequency   maintenance_frequency not null default 'daily',
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

create table maintenance_logs (
  id             uuid primary key default uuid_generate_v4(),
  shift_id       uuid not null references shifts(id),
  store_id       uuid not null references stores(id),
  user_id        uuid not null references users(id),
  template_id    uuid references maintenance_templates(id),
  title          text not null,
  completed      boolean not null default false,
  completed_at   timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- PHOTOS (Foto Registro)
-- ============================================================
create table photos (
  id          uuid primary key default uuid_generate_v4(),
  shift_id    uuid not null references shifts(id),
  store_id    uuid not null references stores(id),
  user_id     uuid not null references users(id),
  storage_path text not null,                          -- Supabase Storage path
  caption     text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TRANSFERS
-- ============================================================
create table transfers (
  id              uuid primary key default uuid_generate_v4(),
  from_store_id   uuid references stores(id),          -- null = warehouse
  to_store_id     uuid references stores(id),          -- null = warehouse
  requested_by    uuid not null references users(id),
  approved_by     uuid references users(id),
  status          transfer_status not null default 'pending',
  notes           text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table transfer_items (
  id           uuid primary key default uuid_generate_v4(),
  transfer_id  uuid not null references transfers(id) on delete cascade,
  product_id   uuid not null references products(id),
  product_name text not null,
  qty          integer not null
);

-- ============================================================
-- VENDING MACHINES
-- ============================================================
create table vending_machines (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references stores(id),
  name        text not null,
  location    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table vending_machine_slots (
  id                 uuid primary key default uuid_generate_v4(),
  vending_machine_id uuid not null references vending_machines(id) on delete cascade,
  product_id         uuid references products(id),
  slot_label         text not null,
  capacity           integer not null default 10,
  current_qty        integer not null default 0
);

-- ============================================================
-- E-COMMERCE ORDERS
-- ============================================================
create table ecommerce_orders (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id),
  order_reference text not null,
  customer_name   text,
  customer_email  text,
  total           numeric(10,2) not null,
  status          text not null default 'pending',      -- pending, processing, shipped, completed
  notes           text,
  fulfilled_by    uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- INVOICE SEQUENCE
-- ============================================================
create sequence invoice_seq start 1;

create or replace function generate_invoice_number()
returns text as $$
begin
  return '#INV-' || lpad(nextval('invoice_seq')::text, 4, '0');
end;
$$ language plpgsql;

-- ============================================================
-- COMPUTED VIEWS
-- ============================================================

-- Shift cash summary (deposito atteso, varianza)
create or replace view shift_cash_summary as
select
  s.id                                        as shift_id,
  s.store_id,
  s.user_id,
  s.period,
  s.status,
  s.fce,
  s.fcu,
  s.deposit_actual,
  coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0)  as total_cash,
  coalesce(sum(sa.total) filter (where sa.payment_method = 'pos'), 0)   as total_pos,
  coalesce(sum(sa.total), 0)                  as total_sales,
  count(sa.id)                                as total_transactions,
  coalesce(sum(e.amount), 0)                  as total_expenses,
  -- Deposito Atteso = FCE + Cash − Spese − FCU
  s.fce
    + coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0)
    - coalesce(sum(e.amount), 0)
    - coalesce(s.fcu, 0)                      as deposit_expected,
  -- Varianza = Deposito Effettivo − Deposito Atteso
  s.deposit_actual - (
    s.fce
    + coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0)
    - coalesce(sum(e.amount), 0)
    - coalesce(s.fcu, 0)
  )                                           as cash_variance,
  s.opened_at,
  s.closed_at
from shifts s
left join sales sa on sa.shift_id = s.id
left join expenses e on e.shift_id = s.id
group by s.id;

-- ============================================================
-- BONUS CALCULATION FUNCTION
-- ============================================================
create or replace function calculate_employee_bonus(
  p_user_id   uuid,
  p_store_id  uuid,
  p_from      date,
  p_to        date
)
returns table (
  total_sales         numeric,
  total_shifts        integer,
  qualifying_shifts   integer,
  avg_sale_per_txn    numeric,
  commission          numeric,
  hours_bonus         numeric,
  total_bonus         numeric
) as $$
declare
  cfg bonus_config%rowtype;
begin
  select * into cfg from bonus_config where store_id = p_store_id and is_active = true;
  if not found then
    -- fallback defaults
    cfg.sales_commission_pct := 0.01;
    cfg.hours_bonus_amount   := 5.00;
    cfg.hours_bonus_threshold := 8;
    cfg.avg_sale_threshold   := 40.00;
  end if;

  return query
  with shift_data as (
    select
      sh.id,
      coalesce(sum(sa.total), 0)      as shift_sales,
      count(sa.id)                    as shift_txns,
      case when count(sa.id) > 0
        then sum(sa.total) / count(sa.id) else 0 end as shift_avg
    from shifts sh
    left join sales sa on sa.shift_id = sh.id
    where sh.user_id = p_user_id
      and sh.store_id = p_store_id
      and sh.status = 'closed'
      and date(sh.opened_at) between p_from and p_to
    group by sh.id
  )
  select
    coalesce(sum(shift_sales), 0)                                          as total_sales,
    count(*)::integer                                                       as total_shifts,
    count(*) filter (where shift_avg > cfg.avg_sale_threshold)::integer     as qualifying_shifts,
    case when sum(shift_txns) > 0
      then sum(shift_sales) / sum(shift_txns) else 0 end                    as avg_sale_per_txn,
    round(sum(shift_sales) * cfg.sales_commission_pct, 2)                   as commission,
    round(
      count(*) filter (where shift_avg > cfg.avg_sale_threshold)
      * cfg.hours_bonus_amount, 2
    )                                                                       as hours_bonus,
    round(
      sum(shift_sales) * cfg.sales_commission_pct
      + count(*) filter (where shift_avg > cfg.avg_sale_threshold) * cfg.hours_bonus_amount,
      2
    )                                                                       as total_bonus
  from shift_data;
end;
$$ language plpgsql security definer;

-- ============================================================
-- DAILY SHIFT REPORT VIEW (for printable cash envelope)
-- ============================================================
create or replace view shift_report_detail as
select
  s.id                    as sale_id,
  s.created_at            as sale_time,
  s.invoice_number,
  s.payment_method,
  s.customer_name,
  s.customer_nationality,
  s.subtotal,
  s.discount_amount,
  s.total,
  s.shift_id,
  sh.store_id,
  sh.user_id,
  sh.period,
  sh.opened_at            as shift_opened_at,
  u.full_name             as employee_name,
  st.name                 as store_name,
  -- aggregated items list
  (
    select json_agg(json_build_object(
      'product', si.product_name,
      'qty', si.qty,
      'unit_price', si.unit_price,
      'line_total', si.line_total
    ))
    from sale_items si where si.sale_id = s.id
  )                       as items
from sales s
join shifts sh  on sh.id = s.shift_id
join users u    on u.id = sh.user_id
join stores st  on st.id = sh.store_id;

-- ============================================================
-- STOCK ALERTS VIEW
-- ============================================================
create or replace view low_stock_products as
select
  p.id,
  p.store_id,
  p.name,
  p.category,
  p.stock,
  p.stock_alert,
  st.name as store_name
from products p
join stores st on st.id = p.store_id
where p.stock <= p.stock_alert
  and p.is_active = true;

-- ============================================================
-- TRIGGER: update product stock on sale
-- ============================================================
create or replace function decrement_stock_on_sale()
returns trigger as $$
begin
  update products
  set stock = stock - new.qty,
      updated_at = now()
  where id = new.product_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_decrement_stock
after insert on sale_items
for each row execute function decrement_stock_on_sale();

-- TRIGGER: restore stock on sale delete (refund/cancel)
create or replace function restore_stock_on_sale_delete()
returns trigger as $$
begin
  update products
  set stock = stock + old.qty,
      updated_at = now()
  where id = old.product_id;
  return old;
end;
$$ language plpgsql;

create trigger trg_restore_stock
after delete on sale_items
for each row execute function restore_stock_on_sale_delete();

-- TRIGGER: auto invoice number
create or replace function set_invoice_number()
returns trigger as $$
begin
  if new.invoice_number is null then
    new.invoice_number := generate_invoice_number();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_invoice_number
before insert on sales
for each row execute function set_invoice_number();

-- TRIGGER: update stock on request delivery
create or replace function apply_stock_delivery()
returns trigger as $$
begin
  if new.qty_delivered is not null and old.qty_delivered is null then
    update products
    set stock = stock + new.qty_delivered,
        updated_at = now()
    where id = new.product_id;
    -- update purchase cost if provided
    if new.cost_per_unit is not null then
      update products set cost = new.cost_per_unit where id = new.product_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_stock_delivery
after update on stock_request_items
for each row execute function apply_stock_delivery();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table stores              enable row level security;
alter table users               enable row level security;
alter table products            enable row level security;
alter table shifts              enable row level security;
alter table sales               enable row level security;
alter table sale_items          enable row level security;
alter table expenses            enable row level security;
alter table stock_requests      enable row level security;
alter table stock_request_items enable row level security;
alter table inventory_counts    enable row level security;
alter table inventory_count_items enable row level security;
alter table maintenance_templates enable row level security;
alter table maintenance_logs    enable row level security;
alter table photos              enable row level security;
alter table transfers           enable row level security;
alter table transfer_items      enable row level security;
alter table vending_machines    enable row level security;
alter table ecommerce_orders    enable row level security;
alter table bonus_config        enable row level security;

-- Helper: get current user's store_id and role
create or replace function auth_store_id() returns uuid as $$
  select store_id from users where id = auth.uid();
$$ language sql security definer;

create or replace function auth_role() returns user_role as $$
  select role from users where id = auth.uid();
$$ language sql security definer;

-- STORES
create policy "Users see own store" on stores
  for select using (id = auth_store_id());
create policy "Owner manages store" on stores
  for all using (auth_role() = 'owner' and id = auth_store_id());

-- USERS
create policy "Users see teammates" on users
  for select using (store_id = auth_store_id());
create policy "Owner manages users" on users
  for all using (auth_role() = 'owner');
create policy "User updates self" on users
  for update using (id = auth.uid());

-- PRODUCTS (same store)
create policy "Store sees products" on products
  for select using (store_id = auth_store_id());
create policy "Owner manages products" on products
  for all using (auth_role() = 'owner' and store_id = auth_store_id());
create policy "Employee reads products" on products
  for select using (store_id = auth_store_id());

-- SHIFTS
create policy "Employee sees own shifts" on shifts
  for select using (user_id = auth.uid() or auth_role() = 'owner');
create policy "Employee manages own shift" on shifts
  for insert with check (user_id = auth.uid());
create policy "Employee closes own shift" on shifts
  for update using (user_id = auth.uid() or auth_role() = 'owner');

-- SALES (store-scoped)
create policy "Store sees sales" on sales
  for select using (store_id = auth_store_id());
create policy "Employee inserts sales" on sales
  for insert with check (store_id = auth_store_id() and user_id = auth.uid());
create policy "Owner deletes sales" on sales
  for delete using (auth_role() = 'owner' and store_id = auth_store_id());

-- SALE ITEMS
create policy "Store sees sale items" on sale_items
  for select using (
    exists (select 1 from sales s where s.id = sale_id and s.store_id = auth_store_id())
  );
create policy "Employee inserts sale items" on sale_items
  for insert with check (
    exists (select 1 from sales s where s.id = sale_id and s.store_id = auth_store_id())
  );

-- EXPENSES
create policy "Store sees expenses" on expenses
  for select using (store_id = auth_store_id());
create policy "Employee inserts expenses" on expenses
  for insert with check (store_id = auth_store_id() and user_id = auth.uid());

-- Generic store-scoped policy for remaining tables
create policy "Store sees stock requests" on stock_requests
  for all using (store_id = auth_store_id());
create policy "Store sees inventory counts" on inventory_counts
  for all using (store_id = auth_store_id());
create policy "Store sees maintenance logs" on maintenance_logs
  for all using (store_id = auth_store_id());
create policy "Store sees photos" on photos
  for all using (store_id = auth_store_id());
create policy "Store sees transfers" on transfers
  for all using (from_store_id = auth_store_id() or to_store_id = auth_store_id());
create policy "Store sees vending" on vending_machines
  for all using (store_id = auth_store_id());
create policy "Store sees ecommerce" on ecommerce_orders
  for all using (store_id = auth_store_id());
create policy "Owner sees bonus config" on bonus_config
  for all using (auth_role() = 'owner' and store_id = auth_store_id());

-- ============================================================
-- SEED: default maintenance templates
-- ============================================================
insert into maintenance_templates (title, frequency, sort_order) values
  ('Pulizia pavimento',             'daily', 1),
  ('Pulizia porta',                 'daily', 2),
  ('Pulizia bagno',                 'daily', 3),
  ('Pulizia bancone',               'daily', 4),
  ('Pulizia scaffali',              'daily', 5),
  ('Pulizia prodotti',              'daily', 6),
  ('Buttare spazzatura',            'daily', 7),
  ('Controllo prodotti scaduti',    'daily', 8),
  ('Etichette prezzi aggiornate',   'daily', 9),
  ('Manutenzione store',            'daily', 10),
  ('Vending machine check',         'daily', 11),
  ('Ricarica vending machine',      'weekly', 12),
  ('Depositi effettuati',           'daily', 13),
  ('Inventario settimanale',        'weekly', 14);

-- SEED: default bonus config (will be overridden per-store)
-- Run after inserting your first store:
-- insert into bonus_config (store_id) values ('<your-store-id>');
