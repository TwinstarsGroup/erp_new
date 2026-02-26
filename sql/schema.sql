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
  -- Batch generation metadata (used by scripts/batch-vouchers.js)
  schedule_key   text,       -- identifies the rule that created this voucher
  period_label   text,       -- e.g. "2025-01" for monthly or "2025-01-17" for Friday
  is_batch       boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create trigger cash_vouchers_updated_at
  before update on cash_vouchers
  for each row execute function update_updated_at();

-- Migrations for existing deployments (safe to run multiple times)
alter table cash_vouchers add column if not exists schedule_key text;
alter table cash_vouchers add column if not exists period_label  text;
alter table cash_vouchers add column if not exists is_batch      boolean default false;

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

-- ── Companies ─────────────────────────────────────────────────
create table if not exists companies (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);

alter table companies enable row level security;

create policy "Authenticated full access on companies" on companies
  for all to authenticated using (true) with check (true);

-- Seed the two required companies
insert into companies (name) values
  ('Twinstar Entertainers LLP'),
  ('Twinstar Datalytiks LLP')
on conflict (name) do nothing;

-- ── Employees ─────────────────────────────────────────────────
create table if not exists employees (
  id               uuid primary key default gen_random_uuid(),
  emp_id           text not null unique,
  emp_name         text not null,
  date_of_joining  date not null,
  account_number   text not null,
  position         text not null,
  company_name     text,
  company_id       uuid references companies(id),
  pan_number       text,
  email            text not null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Migrations for existing deployments (safe to run multiple times)
alter table employees add column if not exists company_id  uuid references companies(id);
alter table employees add column if not exists pan_number  text;
alter table employees alter column company_name drop not null;

create trigger employees_updated_at
  before update on employees
  for each row execute function update_updated_at();

alter table employees enable row level security;

create policy "Authenticated full access on employees" on employees
  for all to authenticated using (true) with check (true);

-- ── Payslips ──────────────────────────────────────────────────
create table if not exists payslips (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references employees(id) on delete cascade,
  period           text not null,
  issue_date       date not null,
  basic_salary     numeric(12,2) not null default 0,
  hra              numeric(12,2) not null default 0,
  other_allowances numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_pay          numeric(12,2) not null default 0,
  pdf_url          text,
  created_at       timestamptz default now()
);

alter table payslips enable row level security;

create policy "Authenticated full access on payslips" on payslips
  for all to authenticated using (true) with check (true);

-- ── Payslips storage bucket ───────────────────────────────────
-- Create a bucket named 'payslips' in Supabase Dashboard → Storage
-- and set it to Public, then add these policies:
--
-- insert into storage.buckets (id, name, public)
--   values ('payslips', 'payslips', true)
--   on conflict (id) do nothing;
--
-- create policy "Authenticated upload payslips" on storage.objects
--   for insert to authenticated with check (bucket_id = 'payslips');
--
-- create policy "Public read payslips" on storage.objects
--   for select using (bucket_id = 'payslips');
--
-- create policy "Authenticated delete payslips" on storage.objects
--   for delete to authenticated using (bucket_id = 'payslips');
