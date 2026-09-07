create extension if not exists "pgcrypto";
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text not null,role text not null default 'athlete' check(role in('athlete','coach')),created_at timestamptz not null default now());
create table public.workout_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,started_at timestamptz not null,ended_at timestamptz,duration_seconds integer,energy_before integer check(energy_before between 1 and 10),energy_after integer check(energy_after between 1 and 10),difficulty integer check(difficulty between 1 and 10),notes text,created_at timestamptz not null default now());
create table public.session_exercises(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.workout_sessions(id) on delete cascade,exercise_name text not null,sets_completed integer default 0,reps_completed integer default 0,notes text);
alter table public.profiles enable row level security;alter table public.workout_sessions enable row level security;alter table public.session_exercises enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "athlete insert own sessions" on public.workout_sessions for insert to authenticated with check(user_id=(select auth.uid()));
create policy "athlete read own sessions" on public.workout_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy "athlete update own sessions" on public.workout_sessions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "athlete insert own exercises" on public.session_exercises for insert to authenticated with check(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
create policy "athlete read own exercises" on public.session_exercises for select to authenticated using(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
-- Après création du compte coach, active ces policies pour permettre au coach de voir les séances.
create policy "coach read sessions" on public.workout_sessions for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='coach'));
create policy "coach read exercises" on public.session_exercises for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='coach'));
