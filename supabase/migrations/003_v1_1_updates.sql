-- ============================================================
-- MamaMary v1.1 — Migration 003
-- Esegui nel SQL Editor di Supabase dopo 001 e 002
-- ============================================================

-- ============================================================
-- MOVEMENT TYPES (nuovi tipi di movimento inventario)
-- ============================================================
create type movement_type as enum (
  'sale',           -- vendita normale
  'reso',           -- reso cliente
  'trasferimento',  -- trasferimento tra negozi
  'rotto',          -- prodotto rotto/danneggiato
  'missing',        -- prodotto mancante
  'autoconsumo',    -- uso interno
  'vendita_errata'  -- vendita errata da correggere
);

-- Aggiunge tipo movimento alla tabella sales
alter table sales
  add column if not exists movement_type movement_type not null default 'sale';

-- Numero documento per resi (#RES-XXXX), trasferimenti (#TRF-XXXX) ecc.
alter table sales
  add column if not exists document_number text;

-- Per i resi: riferimento alla vendita originale
alter table sales
  add column if not exists original_sale_id uuid references sales(id);

-- ============================================================
-- BRAND CONFIG (white-label per negozio)
-- ============================================================
create table if not exists brand_config (
  id                uuid primary key default uuid_generate_v4(),
  store_id          uuid not null references stores(id) on delete cascade unique,
  brand_name        text not null default 'MamaMary',
  logo_letter       text not null default 'M',
  primary_color     text not null default '#22C55E',
  piva              text,
  receipt_header    text,
  receipt_footer    text default 'Grazie per il tuo acquisto!',
  language          text not null default 'it',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table brand_config enable row level security;
create policy "Owner manages brand config" on brand_config
  for all using (auth_role() = 'owner' and store_id = auth_store_id());

-- ============================================================
-- STORE CONFIG (impostazioni operative per negozio)
-- ============================================================
create table if not exists store_config (
  id                    uuid primary key default uuid_generate_v4(),
  store_id              uuid not null references stores(id) on delete cascade unique,
  fcu_default           numeric(10,2) not null default 200.00,
  morning_shift_start   text not null default '08:00',
  morning_shift_end     text not null default '14:00',
  evening_shift_start   text not null default '14:00',
  evening_shift_end     text not null default '22:00',
  stock_alert_threshold integer not null default 5,
  discount_notify_pct   numeric(5,2) not null default 15.00,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table store_config enable row level security;
create policy "Store sees config" on store_config
  for select using (store_id = auth_store_id());
create policy "Owner manages store config" on store_config
  for all using (auth_role() = 'owner' and store_id = auth_store_id());

-- ============================================================
-- VENDING MACHINE STATUS
-- ============================================================
create type vending_status as enum ('online', 'offline', 'maintenance');

alter table vending_machines
  add column if not exists status vending_status not null default 'online',
  add column if not exists daily_revenue numeric(10,2) default 0,
  add column if not exists last_restock_at date,
  add column if not exists next_restock_at date;

-- ============================================================
-- STOCK REQUEST PRIORITY
-- ============================================================
create type request_priority as enum ('alta', 'media', 'bassa');

alter table stock_request_items
  add column if not exists priority request_priority default 'media',
  add column if not exists min_threshold integer default 0;

-- ============================================================
-- DOCUMENT NUMBER SEQUENCE per resi, trasferimenti ecc.
-- ============================================================
create sequence if not exists reso_seq start 1;
create sequence if not exists transfer_doc_seq start 1;
create sequence if not exists broken_seq start 1;

create or replace function generate_document_number(prefix text)
returns text as $$
declare
  seq_val bigint;
begin
  if prefix = 'RES' then
    seq_val := nextval('reso_seq');
  elsif prefix = 'TRF' then
    seq_val := nextval('transfer_doc_seq');
  else
    seq_val := nextval('invoice_seq');
  end if;
  return '#' || prefix || '-' || lpad(seq_val::text, 4, '0');
end;
$$ language plpgsql;

-- ============================================================
-- UPDATED SHIFT CASH SUMMARY VIEW
-- Ora esclude i resi dal conteggio vendite (sono negativi)
-- ============================================================
create or replace view shift_cash_summary as
select
  s.id                                                                    as shift_id,
  s.store_id,
  s.user_id,
  s.period,
  s.status,
  s.fce,
  s.fcu,
  s.deposit_actual,
  -- Solo vendite reali (esclude resi)
  coalesce(sum(sa.total) filter (
    where sa.payment_method = 'cash' and sa.movement_type = 'sale'
  ), 0)                                                                   as total_cash,
  coalesce(sum(sa.total) filter (
    where sa.payment_method = 'pos' and sa.movement_type = 'sale'
  ), 0)                                                                   as total_pos,
  coalesce(sum(sa.total) filter (where sa.movement_type = 'sale'), 0)    as total_sales,
  count(sa.id) filter (where sa.movement_type = 'sale')                  as total_transactions,
  -- Resi (importi negativi)
  coalesce(sum(abs(sa.total)) filter (where sa.movement_type = 'reso'), 0) as total_resi,
  count(sa.id) filter (where sa.movement_type = 'reso')                  as total_resi_count,
  coalesce(sum(e.amount), 0)                                              as total_expenses,
  -- Movimenti anomali
  count(sa.id) filter (where sa.movement_type = 'rotto')                 as total_rotti,
  count(sa.id) filter (where sa.movement_type = 'missing')               as total_missing,
  count(sa.id) filter (where sa.movement_type = 'autoconsumo')           as total_autoconsumo,
  -- Deposito atteso = FCE + Cash − Resi Cash − Spese − FCU
  s.fce
    + coalesce(sum(sa.total) filter (where sa.payment_method = 'cash' and sa.movement_type = 'sale'), 0)
    - coalesce(sum(abs(sa.total)) filter (where sa.movement_type = 'reso' and sa.payment_method = 'cash'), 0)
    - coalesce(sum(e.amount), 0)
    - coalesce(s.fcu, 0)                                                  as deposit_expected,
  s.deposit_actual - (
    s.fce
    + coalesce(sum(sa.total) filter (where sa.payment_method = 'cash' and sa.movement_type = 'sale'), 0)
    - coalesce(sum(abs(sa.total)) filter (where sa.movement_type = 'reso' and sa.payment_method = 'cash'), 0)
    - coalesce(sum(e.amount), 0)
    - coalesce(s.fcu, 0)
  )                                                                       as cash_variance,
  s.opened_at,
  s.closed_at
from shifts s
left join sales sa on sa.shift_id = s.id
left join expenses e on e.shift_id = s.id
group by s.id;

-- ============================================================
-- SEED: brand_config e store_config per i 6 negozi
-- ============================================================
insert into brand_config (store_id, brand_name, logo_letter, receipt_header)
select id, 'MamaMary', 'M', name || ' — ' || coalesce(address, 'Via Roma 1')
from stores
on conflict (store_id) do nothing;

insert into store_config (store_id)
select id from stores
on conflict (store_id) do nothing;
