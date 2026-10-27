// POST /google-connect  { refresh_token }
// Chamado pelo app logo após o login com Google: guarda o refresh token
// (que o navegador recebe uma única vez) e faz a primeira sincronização.
import { adminClient, cors, json, userFromRequest } from '../_shared/http.ts';
import { getGoogleEmail, refreshAccessToken } from '../_shared/google.ts';
import { syncUser } from '../_shared/sync.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = adminClient();
  const userId = await userFromRequest(req, admin);
  if (!userId) return json({ error: 'Não autenticado' }, 401);

  const { refresh_token, timezone } = await req.json().catch(() => ({}));
  if (!refresh_token) return json({ error: 'refresh_token ausente' }, 400);

  let access: string;
  try {
    access = await refreshAccessToken(refresh_token);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
  const email = await getGoogleEmail(access);

  await admin.from('google_tokens').upsert({ user_id: userId, refresh_token, updated_at: new Date().toISOString() });
  await admin.from('profiles').update({
    google_connected: true,
    google_email: email,
    last_sync_error: null,
    ...(typeof timezone === 'string' && timezone ? { timezone } : {}),
  }).eq('user_id', userId);

  // Só sincroniza se já houver ciclo configurado.
  const { count } = await admin.from('cycle_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (count) {
    try {
      const result = await syncUser(admin, userId);
      return json({ ok: true, email, ...result });
    } catch (e) {
      return json({ ok: true, email, syncError: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ ok: true, email });
});
