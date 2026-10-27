-- Rode UMA vez no SQL Editor do Supabase, depois de publicar as funções.
-- Sincroniza todo mundo diariamente às 03:00 (horário de Brasília = 06:00 UTC),
-- para que o Google sempre tenha os próximos 60 dias.
-- Troque <PROJECT_REF> e <CRON_SECRET> pelos seus valores.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cronograma-sync-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/google-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
