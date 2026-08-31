-- Dragonslayer (Projet Berserk) — table d'état de l'app /dragonslayer/
-- À exécuter une fois dans le SQL Editor du projet Supabase GoForScrim.
-- Une seule ligne (id = 'main') porte tout l'état de l'app en jsonb.
-- Accès anon en lecture/écriture assumé (choix utilisateur, pas de login).

create table if not exists public.dragonslayer_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dragonslayer_state enable row level security;

drop policy if exists "dragonslayer anon select" on public.dragonslayer_state;
drop policy if exists "dragonslayer anon insert" on public.dragonslayer_state;
drop policy if exists "dragonslayer anon update" on public.dragonslayer_state;

create policy "dragonslayer anon select" on public.dragonslayer_state
  for select using (true);
create policy "dragonslayer anon insert" on public.dragonslayer_state
  for insert with check (id = 'main');
create policy "dragonslayer anon update" on public.dragonslayer_state
  for update using (id = 'main') with check (id = 'main');

-- Temps réel : les autres appareils voient les écritures instantanément.
alter publication supabase_realtime add table public.dragonslayer_state;
