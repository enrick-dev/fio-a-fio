// POST /google-sync
// - Pelo app (JWT do usuário): sincroniza o cronograma desse usuário.
// - Pelo cron (header x-cron-secret): sincroniza todos os usuários conectados.
import { adminClient, cors, json, userFromRequest } from '../_shared/http.ts';
import { syncUser } from '../_shared/sync.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = adminClient();

  const sent = req.headers.get('x-cron-secret');
  let cronSecret: string | null = null;
  if (sent) {
    // O segredo é gerado no banco (tabela app_config, só a service role lê).
    const { data } = await admin.from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
    cronSecret = data?.value ?? null;
  }
  if (cronSecret && sent === cronSecret) {
    const { data: users } = await admin.from('profiles').select('user_id').eq('google_connected', true);
    const report: Record<string, unknown> = {};
    for (const u of users ?? []) {
      try {
        report[u.user_id] = await syncUser(admin, u.user_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        report[u.user_id] = { error: msg };
        await admin.from('profiles').update({ last_sync_error: msg }).eq('user_id', u.user_id);
      }
    }
    return json({ ok: true, report });
  }

  const userId = await userFromRequest(req, admin);
  if (!userId) return json({ error: 'Não autenticado' }, 401);

  try {
    const result = await syncUser(admin, userId);
    return json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('profiles').update({ last_sync_error: msg }).eq('user_id', userId);
    return json({ ok: false, error: msg }, 500);
  }
});
