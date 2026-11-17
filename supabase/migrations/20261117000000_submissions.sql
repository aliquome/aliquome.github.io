-- Reader submissions for the benchmark tables.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- Readers sign in with a one-time code sent to their email (Supabase Auth),
-- then insert rows here. They can only insert their own pending rows and read
-- their own rows. The GitHub Action (service role key) reviews pending rows,
-- opens a GitHub issue for each valid one and records the outcome.

create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('ranking', 'result', 'fix')),
  table_id     text not null check (char_length(table_id) between 1 and 120),
  proposal     jsonb not null check (pg_column_size(proposal) < 20000),
  reason       text not null check (char_length(reason) between 10 and 4000),
  paper_path   text check (paper_path is null or paper_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  status       text not null default 'pending' check (status in ('pending', 'queued', 'applied', 'rejected')),
  issue_number integer,
  review_note  text,
  updated_at   timestamptz not null default now()
);

create index if not exists submissions_status_idx on public.submissions (status, created_at);
create index if not exists submissions_user_idx on public.submissions (user_id, created_at desc);

alter table public.submissions enable row level security;

-- A reader may add a pending submission for themselves, nothing else.
drop policy if exists "insert own pending" on public.submissions;
create policy "insert own pending" on public.submissions
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and issue_number is null and review_note is null
              and (paper_path is null or split_part(paper_path, '/', 1) = auth.uid()::text));

-- A reader sees only their own submissions. There is no update or delete
-- policy, so only the service role (the GitHub Action) can change a row.
drop policy if exists "read own" on public.submissions;
create policy "read own" on public.submissions
  for select to authenticated
  using (user_id = auth.uid());

-- At most 20 submissions per reader per day.
create or replace function public.submissions_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.submissions
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many suggestions today. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists submissions_rate_limit on public.submissions;
create trigger submissions_rate_limit before insert on public.submissions
  for each row execute function public.submissions_rate_limit();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

-- Papers: PDFs up to 20 MB, readable by anyone once linked from an approved
-- result, written only by signed-in readers into a folder named after them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', true, 20971520, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

drop policy if exists "upload own papers" on storage.objects;
create policy "upload own papers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text and name ~ '\.pdf$');
