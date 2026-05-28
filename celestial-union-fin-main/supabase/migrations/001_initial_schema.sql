-- ─────────────────────────────────────────────────────────────────────────────
-- Cofre do Casal — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ────────────────────────────────────────────────────────────────────

-- Couples first (user_profiles will FK to it)
create table public.couples (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  created_at timestamptz default now()
);

-- User profiles (1-to-1 with auth.users)
create table public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  email        text not null,
  couple_id    uuid references public.couples(id) on delete set null,
  avatar_color text not null default 'from-violet-400 to-fuchsia-500',
  initial      text not null,
  created_at   timestamptz default now()
);

-- Couple ↔ User membership
create table public.couple_members (
  couple_id uuid references public.couples(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (couple_id, user_id)
);

-- Categories (per couple)
create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  name      text not null,
  type      text not null check (type in ('income', 'expense')),
  color     text not null check (color in ('violet', 'emerald', 'coral', 'amber', 'cyan'))
);

-- Accounts (per couple)
create table public.accounts (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid references public.couples(id) on delete cascade not null,
  name       text not null,
  type       text not null,
  balance    numeric not null default 0,
  member_id  uuid references auth.users(id) on delete set null,
  brand      text,
  created_at timestamptz default now()
);

-- Transactions (per couple)
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid references public.couples(id) on delete cascade not null,
  description text not null,
  amount      numeric not null,
  date        timestamptz not null,
  type        text not null check (type in ('income', 'expense')),
  category_id uuid references public.categories(id) on delete set null,
  member_id   uuid references auth.users(id) on delete set null,
  account_id  uuid references public.accounts(id) on delete set null,
  created_at  timestamptz default now()
);

-- Investments (per couple)
create table public.investments (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid references public.couples(id) on delete cascade not null,
  name             text not null,
  ticker           text,
  type             text not null,
  applied          numeric not null default 0,
  projected_yield  numeric not null default 0,
  created_at       timestamptz default now()
);

-- Investment moves (per investment)
create table public.investment_moves (
  id            uuid primary key default gen_random_uuid(),
  investment_id uuid references public.investments(id) on delete cascade not null,
  kind          text not null check (kind in ('aporte', 'resgate')),
  amount        numeric not null,
  date          timestamptz not null,
  created_at    timestamptz default now()
);

-- ── Helper function (used by RLS policies) ────────────────────────────────────

create or replace function public.get_my_couple_id()
returns uuid
language sql
security definer
stable
as $$
  select couple_id from public.user_profiles where id = auth.uid()
$$;

-- ── Row Level Security ─────────────────────────────────────────────────────────

alter table public.user_profiles    enable row level security;
alter table public.couples           enable row level security;
alter table public.couple_members    enable row level security;
alter table public.categories        enable row level security;
alter table public.accounts          enable row level security;
alter table public.transactions      enable row level security;
alter table public.investments       enable row level security;
alter table public.investment_moves  enable row level security;

-- user_profiles
create policy "Users can view own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "Users can view partner profile"
  on public.user_profiles for select
  using (couple_id = public.get_my_couple_id() and couple_id is not null);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.user_profiles for update
  using (id = auth.uid());

-- couples
create policy "Members can view own couple"
  on public.couples for select
  using (id = public.get_my_couple_id());

create policy "Authenticated users can create couple"
  on public.couples for insert
  with check (auth.uid() is not null);

-- couple_members
create policy "Members can view couple_members"
  on public.couple_members for select
  using (couple_id = public.get_my_couple_id());

create policy "Users can join a couple"
  on public.couple_members for insert
  with check (user_id = auth.uid());

-- categories
create policy "Members can view categories"
  on public.categories for select
  using (couple_id = public.get_my_couple_id());

create policy "Members can insert categories"
  on public.categories for insert
  with check (couple_id = public.get_my_couple_id());

create policy "Members can update categories"
  on public.categories for update
  using (couple_id = public.get_my_couple_id());

create policy "Members can delete categories"
  on public.categories for delete
  using (couple_id = public.get_my_couple_id());

-- accounts
create policy "Members can view accounts"
  on public.accounts for select
  using (couple_id = public.get_my_couple_id());

create policy "Members can insert accounts"
  on public.accounts for insert
  with check (couple_id = public.get_my_couple_id());

create policy "Members can update accounts"
  on public.accounts for update
  using (couple_id = public.get_my_couple_id());

create policy "Members can delete accounts"
  on public.accounts for delete
  using (couple_id = public.get_my_couple_id());

-- transactions
create policy "Members can view transactions"
  on public.transactions for select
  using (couple_id = public.get_my_couple_id());

create policy "Members can insert transactions"
  on public.transactions for insert
  with check (couple_id = public.get_my_couple_id());

create policy "Members can update transactions"
  on public.transactions for update
  using (couple_id = public.get_my_couple_id());

create policy "Members can delete transactions"
  on public.transactions for delete
  using (couple_id = public.get_my_couple_id());

-- investments
create policy "Members can view investments"
  on public.investments for select
  using (couple_id = public.get_my_couple_id());

create policy "Members can insert investments"
  on public.investments for insert
  with check (couple_id = public.get_my_couple_id());

create policy "Members can update investments"
  on public.investments for update
  using (couple_id = public.get_my_couple_id());

create policy "Members can delete investments"
  on public.investments for delete
  using (couple_id = public.get_my_couple_id());

-- investment_moves
create policy "Members can view investment_moves"
  on public.investment_moves for select
  using (
    investment_id in (
      select id from public.investments where couple_id = public.get_my_couple_id()
    )
  );

create policy "Members can insert investment_moves"
  on public.investment_moves for insert
  with check (
    investment_id in (
      select id from public.investments where couple_id = public.get_my_couple_id()
    )
  );

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime replication for live sync between partners

alter publication supabase_realtime add table public.couples;
alter publication supabase_realtime add table public.couple_members;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.investments;
alter publication supabase_realtime add table public.investment_moves;
