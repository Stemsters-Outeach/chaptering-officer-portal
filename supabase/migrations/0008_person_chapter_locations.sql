create table if not exists public.person_chapter_locations (
  person_id uuid not null references public.people(id) on delete cascade,
  location_id uuid not null references public.chapter_locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, location_id)
);

alter table public.person_chapter_locations enable row level security;

create policy "Allow anonymous read access"
  on public.person_chapter_locations
  for select
  to anon
  using (true);

create policy "Allow anonymous insert access"
  on public.person_chapter_locations
  for insert
  to anon
  with check (true);

create policy "Allow anonymous delete access"
  on public.person_chapter_locations
  for delete
  to anon
  using (true);

insert into public.person_chapter_locations (person_id, location_id)
select id, location_id from public.people where location_id is not null
on conflict do nothing;

alter table public.people drop column if exists location_id;
