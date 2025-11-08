-- Migration: Create admins table
-- Description: Defines administrator accounts for the Supabase-backed admin portal

-- Ensure the uuid-ossp extension is available for uuid_generate_v4()
create extension if not exists "uuid-ossp";

create table if not exists admins (
    id uuid primary key default uuid_generate_v4(),
    email text not null unique,
    display_name text,
    role text,
    created_at timestamptz not null default now()
);
