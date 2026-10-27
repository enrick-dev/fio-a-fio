// POST /google-disconnect  { remove_items?: boolean }
// Revoga o acesso ao Google. Com remove_items, apaga antes as tarefas/eventos futuros.
import { adminClient, cors, json, userFromRequest } from '../_shared/http.ts';
import { GoogleClient, GoogleNotFound, refreshAccessToken } from '../_shared/google.ts';
import { todayIn } from '../_shared/schedule.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = adminClient();
  const userId = await userFromRequest(req, admin);
  if (!userId) return json({ error: 'Não autenticado' }, 401);
  const { remove_items } = await req.json().catch(() => ({}));

  const { data: tok } = await admin.from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  const { data: profile } = await admin.from('profiles').select('timezone').eq('user_id', userId).single();

  if (tok) {
    try {
      const access = await refreshAccessToken(tok.refresh_token);
      if (remove_items) {
        const g = new GoogleClient(access);
        const today = todayIn(profile?.timezone ?? 'America/Sao_Paulo');
        const { data: items } = await admin.from('synced_items').select('*').eq('user_id', userId).gte('date', today);
        for (const it of items ?? []) {
          try {
            if (it.kind === 'task') await g.deleteTask(it.container_id, it.google_id);
            else await g.deleteEvent(it.container_id, it.google_id);
          } catch (e) {
            if (!(e instanceof GoogleNotFound)) throw e;
          }
        }
      }
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token)}`, { method: 'POST' });
    } catch (_) {
      // token já inválido: segue removendo localmente
    }
  }

  await admin.from('google_tokens').delete().eq('user_id', userId);
  await admin.from('synced_items').delete().eq('user_id', userId);
  await admin.from('profiles').update({
    google_connected: false, google_email: null, tasklist_id: null, calendar_id: null, last_sync_error: null,
  }).eq('user_id', userId);
  return json({ ok: true });
});
