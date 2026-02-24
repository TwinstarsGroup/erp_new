-- ============================================================
-- ERP System — Supabase SQL Schema
-- Run this in the Supabase SQL Editor for your project.
-- ============================================================

-- ── Enable UUID extension ────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Receipts ──────────────────────────────────────────────────
create table if not exists receipts (
  id              uuid primary key default gen_random_uuid(),
  receipt_number  text not null unique,
  date            date not null,
  customer_name   text not null,
  customer_phone  text,
  customer_email  text,
  items           jsonb not null default '[]',
  subtotal        numeric(12,2) not null default 0,
  tax_percent     numeric(5,2)  not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger receipts_updated_at
  before update on receipts
  for each row execute function update_updated_at();

-- ── Cash Vouchers ─────────────────────────────────────────────
create table if not exists cash_vouchers (
  id             uuid primary key default gen_random_uuid(),
  voucher_number text not null unique,
  date           date not null,
  payee          text not null,
  amount         numeric(12,2) not null,
  amount_words   text,
  purpose        text,
  payment_mode   text default 'Cash',
  reference      text,
  approved_by    text,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create trigger cash_vouchers_updated_at
  before update on cash_vouchers
  for each row execute function update_updated_at();

-- ── Attachments ───────────────────────────────────────────────
create table if not exists attachments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  file_path   text not null,
  file_size   bigint,
  mime_type   text,
  public_url  text,
  created_at  timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────
-- Only authenticated users (admins) can read/write all tables.

alter table receipts     enable row level security;
alter table cash_vouchers enable row level security;
alter table attachments  enable row level security;

-- Allow authenticated users full access
create policy "Authenticated full access on receipts" on receipts
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access on cash_vouchers" on cash_vouchers
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access on attachments" on attachments
  for all to authenticated using (true) with check (true);

-- ── Storage bucket ────────────────────────────────────────────
-- Run these separately in the Supabase dashboard → Storage,
-- or uncomment and run via the SQL editor if using psql with
-- the Supabase CLI (requires storage schema).
--
-- insert into storage.buckets (id, name, public)
--   values ('attachments', 'attachments', true)
--   on conflict (id) do nothing;
--
-- create policy "Authenticated upload" on storage.objects
--   for insert to authenticated with check (bucket_id = 'attachments');
--
-- create policy "Public read" on storage.objects
--   for select using (bucket_id = 'attachments');
--
-- create policy "Authenticated delete" on storage.objects
--   for delete to authenticated using (bucket_id = 'attachments');
