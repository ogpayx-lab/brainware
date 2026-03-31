-- ============================================================
-- Supabase Storage — Bucket per le foto registro
-- Esegui questo nel SQL Editor di Supabase
-- ============================================================

-- Crea il bucket 'photos'
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false);

-- Policy: i dipendenti possono caricare foto nel proprio store folder
create policy "Employees can upload photos"
on storage.objects for insert
with check (
  bucket_id = 'photos'
  and auth.uid() is not null
);

-- Policy: i dipendenti possono leggere le foto del proprio store
create policy "Store members can view photos"
on storage.objects for select
using (
  bucket_id = 'photos'
  and auth.uid() is not null
);

-- Policy: solo owner può eliminare
create policy "Owner can delete photos"
on storage.objects for delete
using (
  bucket_id = 'photos'
  and exists (
    select 1 from public.users
    where id = auth.uid() and role = 'owner'
  )
);
