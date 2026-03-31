-- ============================================================
-- BrainWare — Fix SQL da eseguire nel SQL Editor di Supabase
-- Esegui questo INTERO script una sola volta
-- ============================================================

-- ============================================================
-- FIX 1: Trigger che crea automaticamente il profilo in
-- public.users quando un utente si registra tramite auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'employee'  -- ruolo di default, l'onboarding lo aggiornerà a 'owner'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Rimuovi il trigger se già esiste (per poterlo ricreare)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FIX 2: Policy RLS per permettere a un utente di inserire
-- il proprio profilo (necessario se trigger non funziona)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'users' and policyname = 'User inserts own profile'
  ) then
    execute 'create policy "User inserts own profile" on users
      for insert with check (id = auth.uid())';
  end if;
end $$;

-- ============================================================
-- FIX 3: RLS per la tabella organizations
-- (era mancante — blocca tutti gli insert dall'onboarding)
-- ============================================================
alter table organizations enable row level security;

-- Permette agli utenti autenticati di creare organizzazioni
-- (l'onboarding usa la service role, ma teniamo anche questa)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'organizations' and policyname = 'Authenticated user creates org'
  ) then
    execute 'create policy "Authenticated user creates org" on organizations
      for insert with check (auth.uid() is not null)';
  end if;
end $$;

-- Gli utenti vedono la propria organizzazione
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'organizations' and policyname = 'User sees own org'
  ) then
    execute 'create policy "User sees own org" on organizations
      for select using (
        id in (
          select s.organization_id from stores s
          join users u on u.store_id = s.id
          where u.id = auth.uid()
        )
      )';
  end if;
end $$;

-- ============================================================
-- FIX 4: Aggiungi colonna city a stores se mancante
-- (alcune versioni potrebbero non averla)
-- ============================================================
alter table stores
  add column if not exists city text;

-- ============================================================
-- FIX 5: brand_config — permetti insert a utenti con store già assegnato
-- (il trigger owner crea il profilo, ma potrebbe servire durante il setup)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'brand_config' and policyname = 'Employee reads brand config'
  ) then
    execute 'create policy "Employee reads brand config" on brand_config
      for select using (store_id = auth_store_id())';
  end if;
end $$;

-- ============================================================
-- VERIFICA: controlla che il trigger esista
-- ============================================================
select trigger_name, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';
