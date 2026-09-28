-- ============================================================================
-- FOMO — Launch Mode: pre-launch countdown + referral / invite system.
--
-- Everything here is ADDITIVE and BACKEND-CONTROLLED. Turning launch mode on/off,
-- setting the launch date, editing reward tiers and social-proof are all done by
-- editing the single `app_config` row — NO new app build required.
--
-- Anti-abuse guarantees:
--   • The referral counter is ONLY ever incremented by claim_referral() (SECURITY
--     DEFINER). The client can never do `referral_count + 1` itself.
--   • A user can be attributed to a referrer exactly ONCE (referred_by is write-once).
--   • Self-referral is rejected.
--   • The countdown reads server time via server_now()/get_launch_state() — the
--     client clock is never trusted.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

-- ── admin check (re-declared idempotently; matches the existing helper) ─────────────────────────
create or replace function public.is_admin(user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = user_id and u.role = 'admin');
$$;
grant execute on function public.is_admin(uuid) to authenticated, anon;

-- ── 1. users: referral + early-access columns (all additive, safe if re-run) ────────────────────
alter table public.users add column if not exists referral_code   text;
alter table public.users add column if not exists referred_by     uuid references public.users(id) on delete set null;
alter table public.users add column if not exists referral_count  integer not null default 0;
alter table public.users add column if not exists launch_bypass   boolean not null default false;
alter table public.users add column if not exists early_access    boolean not null default false;

-- Unique referral code per user (a unique INDEX allows the many pre-backfill NULLs — Postgres
-- treats NULLs as distinct — so this never blocks the column add).
create unique index if not exists users_referral_code_key on public.users(referral_code);
create index if not exists users_referred_by_idx on public.users(referred_by);

-- ── 2. referral-code generation (unambiguous 6-char codes) ──────────────────────────────────────
create or replace function public.gen_referral_code()
returns text language plpgsql set search_path = public as $$
declare
  v_code  text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I ambiguity
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.users where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Assign a code on insert if the client didn't (the app's users insert doesn't set one).
create or replace function public.set_referral_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.gen_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_referral_code on public.users;
create trigger trg_set_referral_code before insert on public.users
  for each row execute function public.set_referral_code();

-- Backfill existing users. Per-row (own statement) so each new code sees the previous inserts
-- and stays unique.
do $$
declare r record;
begin
  for r in select id from public.users where referral_code is null loop
    update public.users set referral_code = public.gen_referral_code() where id = r.id;
  end loop;
end $$;

-- ── 3. app_config: single-row, backend-controlled launch settings ───────────────────────────────
create table if not exists public.app_config (
  id                   integer primary key default 1 check (id = 1),  -- singleton
  launch_enabled       boolean not null default false,                -- master on/off for launch mode
  launch_at            timestamptz,                                   -- the launch moment (NULL = "coming soon", no date)
  reward_tiers         jsonb   not null default '[]'::jsonb,          -- [{count, reward}, …]
  social_proof_enabled boolean not null default false,               -- show the real signup count on the launch screen
  updated_at           timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Wipe ALL existing policies first (a stray blanket USING(true) policy would OR over these — bitten before).
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_config' loop
    execute format('drop policy if exists %I on public.app_config', r.policyname);
  end loop;
end $$;

-- Everyone signed-in may READ config; only admins may WRITE it.
create policy app_config_read   on public.app_config for select to authenticated using (true);
create policy app_config_insert on public.app_config for insert to authenticated with check (public.is_admin(auth.uid()));
create policy app_config_update on public.app_config for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

grant select, insert, update on public.app_config to authenticated;

-- Seed the singleton row. Launch mode starts DISABLED → nothing changes for any user until an
-- admin flips launch_enabled and sets launch_at. Reward tiers are examples the admin can edit.
insert into public.app_config (id, launch_enabled, launch_at, reward_tiers, social_proof_enabled)
values (
  1, false, null,
  '[
    {"count": 3,  "reward": "גישה מוקדמת לאפליקציה"},
    {"count": 10, "reward": "תג מייסד 🏅"},
    {"count": 25, "reward": "חודש פרימיום חינם"}
  ]'::jsonb,
  false
)
on conflict (id) do nothing;

-- ── 4. server_now: tamper-proof clock for the countdown ─────────────────────────────────────────
create or replace function public.server_now()
returns timestamptz language sql stable security definer set search_path = public as $$
  select now();
$$;
grant execute on function public.server_now() to authenticated, anon;

-- ── 5. get_launch_state: one round-trip → config + server time + caller's referral status ────────
-- SECURITY DEFINER so it can read app_config, the caller's own row, and (only when social proof is
-- on) the signup count, without depending on per-table RLS grants.
create or replace function public.get_launch_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_cfg     record;
  v_usr     record;
  v_signups integer := null;
begin
  select launch_enabled, launch_at, reward_tiers, social_proof_enabled
    into v_cfg from public.app_config where id = 1;

  if v_uid is not null then
    select referral_code, referral_count, referred_by, early_access, launch_bypass,
           (role = 'admin') as is_admin
      into v_usr from public.users where id = v_uid;
  end if;

  -- Social proof: a REAL number only, and only when the admin enabled it.
  if coalesce(v_cfg.social_proof_enabled, false) then
    select count(*) into v_signups from public.users;
  end if;

  return jsonb_build_object(
    'server_now',           now(),
    'launch_enabled',       coalesce(v_cfg.launch_enabled, false),
    'launch_at',            v_cfg.launch_at,
    'reward_tiers',         coalesce(v_cfg.reward_tiers, '[]'::jsonb),
    'social_proof_enabled', coalesce(v_cfg.social_proof_enabled, false),
    'signup_count',         v_signups,
    'referral_code',        v_usr.referral_code,
    'referral_count',       coalesce(v_usr.referral_count, 0),
    'referred_by',          v_usr.referred_by,
    'early_access',         coalesce(v_usr.early_access, false),
    'launch_bypass',        coalesce(v_usr.launch_bypass, false),
    'is_admin',             coalesce(v_usr.is_admin, false)
  );
end;
$$;
grant execute on function public.get_launch_state() to authenticated;

-- ── 6. claim_referral: server-verified attribution (the ONLY path that increments a counter) ─────
create or replace function public.claim_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_code     text := upper(btrim(coalesce(p_code, '')));
  v_referrer uuid;
  v_existing uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  -- Anti double-count: a user is attributed to a referrer at most ONCE, ever.
  select referred_by into v_existing from public.users where id = v_uid;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  select id into v_referrer from public.users where referral_code = v_code;
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'notfound');
  end if;

  -- Anti self-referral.
  if v_referrer = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- Attribute (write-once, guarded again against a concurrent claim) then increment SERVER-SIDE.
  update public.users set referred_by = v_referrer where id = v_uid and referred_by is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  update public.users set referral_count = coalesce(referral_count, 0) + 1 where id = v_referrer;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

select 'FOMO launch_mode ready ✓' as status;
