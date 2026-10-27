-- Cronograma Capilar — esquema inicial

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  sync_mode text not null default 'tasks' check (sync_mode in ('tasks', 'events')),
  reminder_time time not null default '08:00',
  include_da boolean not null default true,
  notify_eve boolean not null default true,
  products jsonb not null default '{}'::jsonb,
  google_connected boolean not null default false,
  google_email text,
  tasklist_id text,
  calendar_id text,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);

create table public.cycle_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  da_days int not null check (da_days between 0 and 10),
  slots jsonb not null,
  anchor_date date not null,
  anchor_pos int not null check (anchor_pos >= 0),
  created_at timestamptz not null default now()
);
create index on public.cycle_versions (user_id, anchor_date);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  from_date date not null,
  days int not null check (days between 1 and 365),
  created_at timestamptz not null default now()
);
create index on public.shifts (user_id, from_date);

create table public.day_logs (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  steps jsonb not null default '{}'::jsonb,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Tokens do Google: sem políticas => só a service role (Edge Functions) acessa.
create table public.google_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- O que já foi criado no Google, para atualizar/apagar sem duplicar.
create table public.synced_items (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  kind text not null check (kind in ('task', 'event')),
  google_id text not null,
  container_id text not null,
  hash text not null,
  primary key (user_id, date, kind)
);

alter table public.profiles enable row level security;
alter table public.cycle_versions enable row level security;
alter table public.shifts enable row level security;
alter table public.day_logs enable row level security;
alter table public.google_tokens enable row level security;
alter table public.synced_items enable row level security;

create policy "own profile" on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own versions" on public.cycle_versions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own shifts" on public.shifts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own logs" on public.day_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own synced" on public.synced_items for select
  using (auth.uid() = user_id);

-- O app só pode alterar as preferências; os campos de conexão são do servidor.
revoke update on public.profiles from authenticated, anon;
grant update (timezone, sync_mode, reminder_time, include_da, notify_eve, products)
  on public.profiles to authenticated;

-- Cria o perfil automaticamente no primeiro login
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
