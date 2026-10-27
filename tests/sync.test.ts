// Teste da sincronização com Google usando banco e Google falsos (rodar com Deno).
// deno test --allow-env tests/sync.test.ts
import { deepStrictEqual as assertEquals } from 'node:assert';
import { syncUser } from '../supabase/functions/_shared/sync.ts';
import { todayIn, addDays } from '../supabase/functions/_shared/schedule.ts';

type Row = Record<string, any>;

function fakeDb(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    tables[name] ??= [];
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'update' | 'delete' = 'select';
    let patch: Row = {};
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => (filters.push((r) => r[k] === v), q),
      gte: (k: string, v: any) => (filters.push((r) => r[k] >= v), q),
      lte: (k: string, v: any) => (filters.push((r) => r[k] <= v), q),
      match: (m: Row) => (Object.entries(m).forEach(([k, v]) => filters.push((r) => r[k] === v)), q),
      update: (p: Row) => ((op = 'update'), (patch = p), q),
      delete: () => ((op = 'delete'), q),
      upsert: (row: Row) => {
        const keys = name === 'synced_items' ? ['user_id', 'date', 'kind'] : name === 'day_logs' ? ['user_id', 'date'] : ['user_id'];
        const t = tables[name];
        const i = t.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) t[i] = { ...t[i], ...row };
        else t.push({ ...row });
        return Promise.resolve({ data: row, error: null });
      },
      run() {
        const t = tables[name];
        const hit = t.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') tables[name] = t.filter((r) => !hit.includes(r));
        return hit;
      },
      single: () => Promise.resolve({ data: q.run()[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: q.run()[0] ?? null, error: null }),
      then: (res: any, rej: any) => Promise.resolve({ data: q.run(), error: null }).then(res, rej),
    };
    return q;
  };
  return { from } as any;
}

function fakeGoogle() {
  const tasks = new Map<string, Row>();
  let n = 0;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/\?.*/, '')}`);
    const body = init?.body && String(init.body).startsWith("{") ? JSON.parse(String(init.body)) : undefined;
    const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s });
    if (url.includes('oauth2.googleapis.com/token')) return j({ access_token: 'tok' });
    if (url.endsWith('/users/@me/lists') && method === 'POST') return j({ id: 'list1' });
    if (url.includes('/users/@me/lists/')) return j({ id: 'list1' });
    const m = url.match(/lists\/(\w+)\/tasks(?:\/(\w+))?/);
    if (m) {
      const id = m[2];
      if (method === 'GET') return j({ items: [...tasks.values()] });
      if (method === 'POST') { const t = { ...body, id: `t${++n}` }; tasks.set(t.id, t); return j(t); }
      if (!tasks.has(id!)) return j({}, 404);
      if (method === 'PATCH') { tasks.set(id!, { ...tasks.get(id!), ...body }); return j(tasks.get(id!)); }
      if (method === 'DELETE') { tasks.delete(id!); return new Response(null, { status: 204 }); }
    }
    return j({ error: 'unexpected ' + url }, 500);
  }) as typeof fetch;
  return { tasks, calls };
}

Deno.env.set('GOOGLE_CLIENT_ID', 'x');
Deno.env.set('GOOGLE_CLIENT_SECRET', 'y');

const tz = 'America/Maceio';
const today = todayIn(tz);
const slots = [
  { type: 'lav', detox: false }, { type: 'h', detox: false }, { type: 'lav', detox: false },
  { type: 'n', detox: false }, { type: 'lav', detox: false }, { type: 'r', detox: true },
];

function setup(includeDa: boolean) {
  return {
    profiles: [{ user_id: 'u', timezone: tz, sync_mode: 'tasks', reminder_time: '08:00:00', include_da: includeDa, notify_eve: true, products: { n: 'Máscara X' }, tasklist_id: null, calendar_id: null }],
    google_tokens: [{ user_id: 'u', refresh_token: 'r' }],
    cycle_versions: [{ id: 'v', user_id: 'u', da_days: 2, slots, anchor_date: today, anchor_pos: 0, created_at: '1' }],
    shifts: [] as Row[],
    day_logs: [] as Row[],
    synced_items: [] as Row[],
  };
}

Deno.test('cria só as lavagens, é idempotente e acompanha remarcações', async () => {
  const tables = setup(false);
  const db = fakeDb(tables);
  const g = fakeGoogle();

  const r1 = await syncUser(db, 'u');
  // 75 dias (14 passados + hoje + 60) a partir da âncora de hoje => dias de hoje até +60: 61 dias / 3 = 20 lavagens + 1 ( pos 2 em +59? )
  const washes = tables.synced_items.length;
  assertEquals(r1.created, washes);
  assertEquals(g.tasks.size, washes);
  assertEquals(washes, 20);
  const first = [...g.tasks.values()].find((t) => t.due.startsWith(addDays(today, 2)))!;
  assertEquals(first.title, 'Shampoo + condicionador');

  // Sem mudanças: nada a fazer
  const r2 = await syncUser(db, 'u');
  assertEquals(r2, { created: 0, updated: 0, deleted: 0 });

  // Remarca a lavagem de hoje+2 para hoje+4
  tables.shifts.push({ id: 's', user_id: 'u', from_date: addDays(today, 2), days: 2, created_at: '2' });
  const r3 = await syncUser(db, 'u');
  const dates = tables.synced_items.map((s) => s.date).sort();
  assertEquals(dates[0], addDays(today, 4));
  assertEquals(r3.created + r3.updated + r3.deleted > 0, true);
  assertEquals(g.tasks.size, tables.synced_items.length);

  // Concluir no Google volta para o app
  const item = tables.synced_items.find((s) => s.date === addDays(today, 4))!;
  g.tasks.get(item.google_id)!.status = 'completed';
  await syncUser(db, 'u');
  assertEquals(tables.day_logs.find((l) => l.date === addDays(today, 4))?.done, true);

  // Nutrição leva o nome do produto
  const nut = [...g.tasks.values()].find((t) => t.title === 'Shampoo + nutrição')!;
  assertEquals(nut.notes.includes('Máscara X'), true);
});

Deno.test('incluir day after cria um item por dia', async () => {
  const tables = setup(true);
  const db = fakeDb(tables);
  const g = fakeGoogle();
  await syncUser(db, 'u');
  assertEquals(tables.synced_items.length, 61);
  assertEquals(g.tasks.size, 61);
});
