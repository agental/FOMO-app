/*
  # Real payments — seller payout accounts + a payments ledger

  Adds the two tables the real ticket-payment layer needs. Until now "payment" was a 1.4s
  setTimeout in BookingFlow and NO money moved, NO payout reached the organizer, and there was
  nowhere for an organizer to say WHERE the money should land. This closes the data gap:

    - seller_accounts : one row per organizer who sells paid tickets. We NEVER store a raw IBAN
                        here — the PSP (Grow/Meshulam) collects bank + ID and runs KYC on its
                        hosted onboarding page; we keep only the resulting `account_id` + status.
    - payments        : one row per ticket purchase (the order). The single source of truth for
                        amount, platform fee, seller share, provider ref and status. Written ONLY
                        by the Edge Functions (service role) — never by the client.

  ## Security (deliberately strict — see the parallel RLS audit)
    - Both tables: RLS ON, and NO insert/update/delete policy for the `authenticated` role, so a
      signed-in client CANNOT forge a "paid" row or flip a seller to "active". All writes happen
      in Edge Functions using the service-role key, which bypasses RLS.
    - seller_accounts SELECT : the owner reads only their own row (+ admins).
    - payments SELECT        : only the buyer or the seller of that order (+ admins).

  Money is kept in shekels (numeric) to match events.price / event_join_requests.paid_amount.
  Conversion to agorot happens at the PSP boundary inside the Edge Function.

  Run once in the Supabase SQL Editor.
*/

-- ── seller_accounts ─────────────────────────────────────────────────────────────────────────
create table if not exists public.seller_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  provider        text not null default 'grow',
  account_id      text,                                  -- the seller's id at the PSP (sub-merchant)
  status          text not null default 'pending',       -- pending | active | restricted | disabled
  payouts_enabled boolean not null default false,        -- true once KYC passes and payouts are on
  details         jsonb not null default '{}'::jsonb,     -- masked bank last4, business name, onboarding_url…
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

-- ── payments (the order ledger) ─────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references public.events(id)              on delete set null,
  join_request_id uuid references public.event_join_requests(id) on delete set null,
  buyer_id        uuid references public.users(id)               on delete set null,
  seller_id       uuid references public.users(id)               on delete set null,
  ticket_label    text,
  quantity        integer not null default 1,
  amount          numeric not null,             -- total charged to the buyer (₪, incl. platform fee)
  platform_fee    numeric not null default 0,   -- FOMO's cut (₪)
  seller_amount   numeric not null default 0,   -- what the seller receives (₪)
  currency        text    not null default 'ILS',
  provider        text    not null default 'grow',
  provider_ref    text,                          -- transaction id at the PSP
  status          text    not null default 'created', -- created|pending|paid|failed|refunded|released
  hold_until      timestamptz,                   -- release payout to the seller only after the event
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_payments_buyer  on public.payments(buyer_id);
create index if not exists idx_payments_seller on public.payments(seller_id);
create index if not exists idx_payments_event  on public.payments(event_id);
create index if not exists idx_seller_accounts_user on public.seller_accounts(user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.seller_accounts enable row level security;
alter table public.payments        enable row level security;

-- Owner (or admin) may READ their own seller account. No client writes at all.
drop policy if exists seller_accounts_select_own on public.seller_accounts;
create policy seller_accounts_select_own on public.seller_accounts
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Buyer or seller (or admin) may READ an order. No client writes at all.
drop policy if exists payments_select_party on public.payments;
create policy payments_select_party on public.payments
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ── keep updated_at fresh ───────────────────────────────────────────────────────────────────
create or replace function public.set_payments_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_seller_accounts_updated_at on public.seller_accounts;
create trigger trg_seller_accounts_updated_at
  before update on public.seller_accounts
  for each row execute function public.set_payments_updated_at();

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_payments_updated_at();

-- ── realtime (so a seller sees a sale / KYC status flip live) ───────────────────────────────
do $$ begin alter publication supabase_realtime add table public.seller_accounts;
exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.payments;
exception when others then null; end $$;
