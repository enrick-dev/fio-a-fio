// Sincroniza o cronograma de um usuário com o Google (Tasks ou Calendar).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  Schedule, addDays, dayTitle, daySteps, isWash, todayIn,
  type CycleVersion, type DayInfo, type Products, type Shift,
} from './schedule.ts';
import { GoogleAuthError, GoogleClient, GoogleNotFound, refreshAccessToken } from './google.ts';

export const APP_NAME = 'Fio a Fio';
const PAST_DAYS = 14; // reescreve as últimas 2 semanas (remarcações em dias passados)
const FUTURE_DAYS = 60;

// Cores de evento do Google Calendar
const EVENT_COLOR: Record<string, string> = { da: '4', wait: '4', lav: '2', h: '7', n: '5', r: '3' };

type Kind = 'task' | 'event';

interface Desired {
  date: string;
  title: string;
  notes: string;
  done: boolean;
  info: DayInfo;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
}

async function hash(s: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function syncUser(admin: SupabaseClient, userId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0 };

  const [{ data: profile }, { data: tokenRow }, { data: versionsRaw }, { data: shiftsRaw }] = await Promise.all([
    admin.from('profiles').select('*').eq('user_id', userId).single(),
    admin.from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle(),
    admin.from('cycle_versions').select('*').eq('user_id', userId),
    admin.from('shifts').select('*').eq('user_id', userId),
  ]);
  if (!profile) throw new Error('Perfil não encontrado');
  if (!tokenRow) throw new Error('Google não conectado');

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(tokenRow.refresh_token);
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      await admin.from('profiles').update({ google_connected: false, last_sync_error: e.message }).eq('user_id', userId);
    }
    throw e;
  }
  const g = new GoogleClient(accessToken);

  const tz: string = profile.timezone;
  const today = todayIn(tz);
  const start = addDays(today, -PAST_DAYS);
  const end = addDays(today, FUTURE_DAYS);
  const kind: Kind = profile.sync_mode === 'events' ? 'event' : 'task';
  const otherKind: Kind = kind === 'task' ? 'event' : 'task';

  const versions: CycleVersion[] = (versionsRaw ?? []).map((v: any) => ({
    id: v.id, daDays: v.da_days, slots: v.slots, anchorDate: v.anchor_date, anchorPos: v.anchor_pos, createdAt: v.created_at,
  }));
  const shifts: Shift[] = (shiftsRaw ?? []).map((s: any) => ({ id: s.id, fromDate: s.from_date, days: s.days, createdAt: s.created_at }));
  const schedule = new Schedule(versions, shifts);

  const { data: syncedRaw } = await admin.from('synced_items').select('*').eq('user_id', userId).gte('date', start);
  const synced = syncedRaw ?? [];

  // 1) Se trocou o modo (tarefas <-> eventos), remove os itens do modo antigo.
  const stale = synced.filter((s: any) => s.kind === otherKind);
  await pool(stale, 5, async (s: any) => {
    try {
      if (s.kind === 'task') await g.deleteTask(s.container_id, s.google_id);
      else await g.deleteEvent(s.container_id, s.google_id);
    } catch (e) {
      if (!(e instanceof GoogleNotFound)) throw e;
    }
    await admin.from('synced_items').delete().match({ user_id: userId, date: s.date, kind: s.kind });
    result.deleted++;
  });

  // 2) Garante a lista de tarefas / agenda própria do app.
  let containerId: string;
  if (kind === 'task') {
    containerId = await g.ensureTaskList(profile.tasklist_id, APP_NAME);
    if (containerId !== profile.tasklist_id) await admin.from('profiles').update({ tasklist_id: containerId }).eq('user_id', userId);
  } else {
    containerId = await g.ensureCalendar(profile.calendar_id, APP_NAME, tz);
    if (containerId !== profile.calendar_id) await admin.from('profiles').update({ calendar_id: containerId }).eq('user_id', userId);
  }

  const mine = synced.filter((s: any) => s.kind === kind);

  // 3) Tarefas concluídas no Google voltam para o app.
  const { data: logsRaw } = await admin.from('day_logs').select('*').eq('user_id', userId).gte('date', start).lte('date', end);
  const logs = new Map<string, any>((logsRaw ?? []).map((l: any) => [l.date, l]));
  if (kind === 'task' && mine.length) {
    const remote = await g.listTasks(containerId);
    const completed = new Set(remote.filter((t: any) => t.status === 'completed').map((t: any) => t.id));
    for (const s of mine) {
      const log = logs.get(s.date);
      if (completed.has(s.google_id) && !log?.done && s.date >= today) {
        const row = { user_id: userId, date: s.date, done: true, steps: log?.steps ?? {}, updated_at: new Date().toISOString() };
        await admin.from('day_logs').upsert(row);
        logs.set(s.date, row);
      }
    }
  }

  // 4) O que deveria existir no Google.
  const products: Products = profile.products ?? {};
  const desired = new Map<string, Desired>();
  for (const info of schedule.range(start, PAST_DAYS + FUTURE_DAYS + 1)) {
    const wash = isWash(info.type);
    if (!wash && !profile.include_da) continue;
    const steps = daySteps(info, products);
    const done = logs.get(info.date)?.done === true || (wash && info.date < today);
    desired.set(info.date, {
      date: info.date,
      info,
      done,
      title: (wash ? '' : '· ') + dayTitle(info),
      notes:
        steps.map((s, i) => `${i + 1}. ${s.label} — ${s.sub}`).join('\n') +
        (info.pos >= 0 ? `\n\nDia ${info.pos + 1} de ${info.cycleLength} do ciclo · ${APP_NAME}` : `\n\n${APP_NAME}`),
    });
  }

  const reminderMin = minutesOf(String(profile.reminder_time).slice(0, 5));
  const bodyFor = (d: Desired) => {
    if (kind === 'task') {
      return {
        title: d.title,
        notes: d.notes,
        due: `${d.date}T00:00:00.000Z`,
        status: d.done ? 'completed' : 'needsAction',
        ...(d.done ? {} : { completed: null }),
      };
    }
    const startMin = reminderMin;
    const endMin = Math.min(startMin + 30, 23 * 60 + 59);
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const overrides: { method: string; minutes: number }[] = [];
    if (isWash(d.info.type) && !d.done) {
      overrides.push({ method: 'popup', minutes: 0 });
      if (profile.notify_eve) overrides.push({ method: 'popup', minutes: startMin + 4 * 60 }); // 20h da véspera
    }
    return {
      summary: (d.done ? '✓ ' : '') + d.title,
      description: d.notes,
      start: { dateTime: `${d.date}T${hhmm(startMin)}:00`, timeZone: tz },
      end: { dateTime: `${d.date}T${hhmm(endMin)}:00`, timeZone: tz },
      colorId: EVENT_COLOR[d.info.type],
      transparency: 'transparent',
      reminders: { useDefault: false, overrides },
    };
  };

  const existing = new Map<string, any>(mine.map((s: any) => [s.date, s]));
  const jobs: (() => Promise<void>)[] = [];

  for (const d of desired.values()) {
    const body = bodyFor(d);
    const h = await hash(JSON.stringify(body) + containerId);
    const ex = existing.get(d.date);
    if (ex && ex.hash === h && ex.container_id === containerId) continue;
    jobs.push(async () => {
      let googleId: string | null = null;
      if (ex && ex.container_id === containerId) {
        try {
          if (kind === 'task') await g.patchTask(containerId, ex.google_id, body);
          else await g.patchEvent(containerId, ex.google_id, body);
          googleId = ex.google_id;
          result.updated++;
        } catch (e) {
          if (!(e instanceof GoogleNotFound)) throw e; // apagado no Google: recria
        }
      }
      if (!googleId) {
        const created = kind === 'task' ? await g.insertTask(containerId, body) : await g.insertEvent(containerId, body);
        googleId = created.id;
        result.created++;
      }
      await admin.from('synced_items').upsert({
        user_id: userId, date: d.date, kind, google_id: googleId, container_id: containerId, hash: h,
      });
    });
  }

  for (const ex of mine) {
    if (desired.has(ex.date)) continue;
    jobs.push(async () => {
      try {
        if (kind === 'task') await g.deleteTask(ex.container_id, ex.google_id);
        else await g.deleteEvent(ex.container_id, ex.google_id);
      } catch (e) {
        if (!(e instanceof GoogleNotFound)) throw e;
      }
      await admin.from('synced_items').delete().match({ user_id: userId, date: ex.date, kind });
      result.deleted++;
    });
  }

  await pool(jobs, 5, (job) => job());

  await admin.from('profiles')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null, google_connected: true })
    .eq('user_id', userId);
  return result;
}
