create table if not exists public.life_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.life_states enable row level security;

grant select, insert, update on public.life_states to authenticated;

drop policy if exists "Users can read their own life state" on public.life_states;
create policy "Users can read their own life state"
on public.life_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own life state" on public.life_states;
create policy "Users can create their own life state"
on public.life_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own life state" on public.life_states;
create policy "Users can update their own life state"
on public.life_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
