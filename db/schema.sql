-- =====================================================================
--  Waselni · Live Trial — Supabase schema  (matches the real screens)
--  Run once: Supabase project → SQL Editor → New query → paste all → Run
-- =====================================================================

-- Real user profile — mirrors the `waselni_profile` localStorage object ----
create table if not exists trial_users (
  id           uuid primary key default gen_random_uuid(),
  legal_name   text not null,                 -- waselni_profile.legalName
  display_name text,                           -- .displayName  (nickname; shown if set)
  username     text,                           -- login handle = first name (lowercased); also the display name across the app
  pin          text,                           -- 4-digit login PIN (trial only — low-security by design, no email/SMS)
  gender       text,                           -- .gender
  nationality  text,                           -- .nationality
  role         text default 'both',            -- waselni_role: passenger | driver | both
  job_titles   text[] default '{}',            -- .jobTitles  (≤3; "profession")
  interests    text[] default '{}',            -- .interests  (≥2)
  audience     text[] default '{}',            -- .preferences (people-types they want to meet, ≤5)
  company      text,                            -- not in prototype; optional, helps matching
  platforms    jsonb  default '{}'::jsonb,      -- .platforms  {linkedin, instagram}
  created_at   timestamptz default now()
);

-- Phase 2: a driver's posted journey -----------------------------------
create table if not exists trial_journeys (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid references trial_users(id) on delete cascade,
  from_area   text not null,
  to_area     text not null,
  depart_label text,                            -- display string, e.g. "Today 9:00 AM"
  seats       int default 3,
  notes       text,
  created_at  timestamptz default now()
);

-- Phase 2: a passenger asking to join (becomes a "match") --------------
create table if not exists trial_requests (
  id           uuid primary key default gen_random_uuid(),
  journey_id   uuid references trial_journeys(id) on delete cascade,
  passenger_id uuid references trial_users(id)    on delete cascade,
  status       text default 'pending',           -- pending | accepted | declined
  created_at   timestamptz default now(),
  unique (journey_id, passenger_id)
);

-- Phase 2/3: connections (the "Stars Aligned" networking layer) --------
create table if not exists trial_connections (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid references trial_users(id) on delete cascade,
  user_b     uuid references trial_users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_a, user_b)
);

-- Login columns, if the table already exists from an earlier run (idempotent)
alter table trial_users add column if not exists username text;
alter table trial_users add column if not exists pin      text;
-- A person = first-name + PIN together (two "Ahmed"s are told apart by PIN)
create unique index if not exists trial_users_login_uidx on trial_users (lower(username), pin);

-- ---- Row Level Security (closed trust-based trial; no sensitive data) ----
alter table trial_users       enable row level security;
alter table trial_journeys    enable row level security;
alter table trial_requests    enable row level security;
alter table trial_connections enable row level security;

create policy "read users"        on trial_users       for select using (true);
create policy "read journeys"     on trial_journeys    for select using (true);
create policy "read requests"     on trial_requests    for select using (true);
create policy "read connections"  on trial_connections for select using (true);
create policy "insert users"      on trial_users       for insert with check (true);
create policy "insert journeys"   on trial_journeys    for insert with check (true);
create policy "insert requests"   on trial_requests    for insert with check (true);
create policy "insert connections" on trial_connections for insert with check (true);
create policy "update users"      on trial_users       for update using (true) with check (true);
create policy "update journeys"   on trial_journeys    for update using (true) with check (true);
create policy "update requests"   on trial_requests    for update using (true) with check (true);
create policy "delete journeys"   on trial_journeys    for delete using (true);
create policy "delete requests"   on trial_requests    for delete using (true);

-- Live updates (harmless if a line says "already a member") -------------
alter publication supabase_realtime add table trial_users;
alter publication supabase_realtime add table trial_journeys;
alter publication supabase_realtime add table trial_requests;
