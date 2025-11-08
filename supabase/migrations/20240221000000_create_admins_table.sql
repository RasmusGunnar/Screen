-- ===============================
-- Supabase setup: admins, RLS, triggers, data tables, storage
-- Safe to run multiple times (idempotent)
-- ===============================

-- === UUID extension (required for uuid_generate_v4) ===
create extension if not exists "uuid-ossp";

-- ==========================================
-- admins
-- ==========================================
create table if not exists public.admins (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  display_name text,
  role text check (role in ('superadmin','editor')) default 'editor',
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- policies (only create if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admins' and policyname='admins: select own row'
  ) then
    create policy "admins: select own row"
      on public.admins
      for select
      to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admins' and policyname='admins: write if editor/superadmin on self'
  ) then
    create policy "admins: write if editor/superadmin on self"
      on public.admins
      for update
      to authenticated
      using (auth.uid() = id and (select role from public.admins where id = auth.uid()) in ('editor','superadmin'))
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admins' and policyname='admins: delete if superadmin on self'
  ) then
    create policy "admins: delete if superadmin on self"
      on public.admins
      for delete
      to authenticated
      using (auth.uid() = id and (select role from public.admins where id = auth.uid()) = 'superadmin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admins' and policyname='admins: insert by superadmin'
  ) then
    create policy "admins: insert by superadmin"
      on public.admins
      for insert
      to authenticated
      with check ((select role from public.admins where id = auth.uid()) = 'superadmin');
  end if;
end $$;

-- ==========================================
-- auth trigger: mirror auth.users -> admins
-- ==========================================
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admins (id, email, display_name, role)
  values (
    new.id,
    new.email,
    split_part(coalesce(new.raw_user_meta_data->>'name', new.email), '@', 1),
    'editor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Create trigger only if missing
do $$
begin
  if not exists (
    select 1
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where tg.tgname = 'on_auth_user_created'
      and n.nspname = 'auth'
      and c.relname = 'users'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_auth_user_created();
  end if;
end $$;

-- ==========================================
-- Helper functions for RLS predicates
-- ==========================================
create or replace function public.is_editor_or_superadmin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.admins
    where id = auth.uid() and role in ('editor','superadmin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.admins
    where id = auth.uid() and role = 'superadmin'
  );
$$;

-- ==========================================
-- kiosk_state (Firestore doc → table)
-- ==========================================
create table if not exists public.kiosk_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.kiosk_state enable row level security;

create or replace function public.set_audit_cols()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  return new;
end;
$$;

-- audit trigger (create if missing)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname='kiosk_state_audit') then
    create trigger kiosk_state_audit
    before insert or update on public.kiosk_state
    for each row execute function public.set_audit_cols();
  end if;
end $$;

-- RLS policies

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='kiosk_state' and policyname='kiosk_state: read authenticated'
  ) then
    create policy "kiosk_state: read authenticated"
      on public.kiosk_state
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='kiosk_state' and policyname='kiosk_state: write editors'
  ) then
    create policy "kiosk_state: write editors"
      on public.kiosk_state
      for insert
      to authenticated
      with check (public.is_editor_or_superadmin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='kiosk_state' and policyname='kiosk_state: update editors'
  ) then
    create policy "kiosk_state: update editors"
      on public.kiosk_state
      for update
      to authenticated
      using (public.is_editor_or_superadmin())
      with check (public.is_editor_or_superadmin());
  end if;
end $$;

-- ==========================================
-- employees
-- ==========================================
create table if not exists public.employees (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  title text,
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.employees enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='employees_audit') then
    create trigger employees_audit
    before insert or update on public.employees
    for each row execute function public.set_audit_cols();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employees' and policyname='employees: read authenticated'
  ) then
    create policy "employees: read authenticated"
      on public.employees
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employees' and policyname='employees: write editors'
  ) then
    create policy "employees: write editors"
      on public.employees
      for insert
      to authenticated
      with check (public.is_editor_or_superadmin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employees' and policyname='employees: update editors'
  ) then
    create policy "employees: update editors"
      on public.employees
      for update
      to authenticated
      using (public.is_editor_or_superadmin())
      with check (public.is_editor_or_superadmin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employees' and policyname='employees: delete superadmins'
  ) then
    create policy "employees: delete superadmins"
      on public.employees
      for delete
      to authenticated
      using (public.is_superadmin());
  end if;
end $$;

-- ==========================================
-- guests (optional guest list)
-- ==========================================
create table if not exists public.guests (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text,
  visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.guests enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='guests_audit') then
    create trigger guests_audit
    before insert or update on public.guests
    for each row execute function public.set_audit_cols();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='guests' and policyname='guests: read authenticated'
  ) then
    create policy "guests: read authenticated"
      on public.guests
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='guests' and policyname='guests: write editors'
  ) then
    create policy "guests: write editors"
      on public.guests
      for insert
      to authenticated
      with check (public.is_editor_or_superadmin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='guests' and policyname='guests: update editors'
  ) then
    create policy "guests: update editors"
      on public.guests
      for update
      to authenticated
      using (public.is_editor_or_superadmin())
      with check (public.is_editor_or_superadmin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='guests' and policyname='guests: delete superadmins'
  ) then
    create policy "guests: delete superadmins"
      on public.guests
      for delete
      to authenticated
      using (public.is_superadmin());
  end if;
end $$;

-- ==========================================
-- Storage: buckets + policies
-- ==========================================
-- Buckets (public); insert ignores existing buckets
insert into storage.buckets (id, name, public)
values
  ('screensaver','screensaver', true),
  ('people','people', true)
on conflict (id) do nothing;

-- Supabase already manages row level security for storage.objects; we only add policies.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='storage: public read screensaver/people'
  ) then
    create policy "storage: public read screensaver/people"
      on storage.objects
      for select
      to public
      using (bucket_id in ('screensaver','people'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='storage: insert editors'
  ) then
    create policy "storage: insert editors"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id in ('screensaver','people') and public.is_editor_or_superadmin()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='storage: update editors'
  ) then
    create policy "storage: update editors"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id in ('screensaver','people') and public.is_editor_or_superadmin()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='storage: delete superadmins'
  ) then
    create policy "storage: delete superadmins"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id in ('screensaver','people') and public.is_superadmin()
      );
  end if;
end $$;

-- ==========================================
-- (OPTIONAL) Seed a superadmin AFTER creating the auth user
-- Replace values before running these lines manually.
-- insert into public.admins (id, email, display_name, role)
-- values ('<auth.users.id>', 'admin@example.com', 'Admin Navn', 'superadmin')
-- on conflict (id) do update set role='superadmin';
