-- Sincronização diária automática (pg_cron + pg_net).
-- O segredo do cron é gerado no próprio banco: nada para copiar e colar.

create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
-- sem políticas: só a service role (Edge Functions) e o próprio banco leem.

insert into public.app_config (key, value)
values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Chama a função google-sync todo dia às 06:00 UTC (03:00 em Brasília).
create or replace function public.trigger_daily_sync() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text := (select value from public.app_config where key = 'functions_url');
  secret text := (select value from public.app_config where key = 'cron_secret');
begin
  if base_url is null then
    return;
  end if;
  perform net.http_post(
    url := base_url || '/google-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb
  );
end;
$$;
revoke execute on function public.trigger_daily_sync() from public, anon, authenticated;

select cron.schedule('fio-a-fio-sync-diario', '0 6 * * *', $$select public.trigger_daily_sync()$$);
