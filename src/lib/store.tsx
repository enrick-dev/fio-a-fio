import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Schedule, todayIn, type CycleVersion, type Products, type Shift, type Slot } from '@shared/schedule.ts';
import { browserTimeZone } from './format';
import { GOOGLE_SCOPES } from '../config';

export interface Profile {
  user_id: string;
  timezone: string;
  sync_mode: 'tasks' | 'events';
  reminder_time: string;
  notify_eve: boolean;
  products: Products;
  google_connected: boolean;
  google_email: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export interface DayLog {
  date: string;
  steps: Record<string, boolean>;
  done: boolean;
}

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error';

interface Store {
  session: Session | null;
  authReady: boolean;
  loading: boolean;
  profile: Profile | null;
  versions: CycleVersion[];
  shifts: Shift[];
  logs: Map<string, DayLog>;
  schedule: Schedule;
  today: string;
  sync: SyncState;
  syncError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  saveCycle: (daDays: number, slots: Slot[], anchorPos: number) => Promise<void>;
  reschedule: (fromDate: string, days: number) => Promise<string | null>;
  removeShift: (id: string) => Promise<void>;
  setStep: (date: string, stepId: string, value: boolean, allIds: string[]) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  syncNow: () => void;
  disconnectGoogle: (removeItems: boolean) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
};

const toVersion = (v: any): CycleVersion => ({
  id: v.id, daDays: v.da_days, slots: v.slots, anchorDate: v.anchor_date, anchorPos: v.anchor_pos, createdAt: v.created_at,
});
const toShift = (s: any): Shift => ({ id: s.id, fromDate: s.from_date, days: s.days, createdAt: s.created_at });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [versions, setVersions] = useState<CycleVersion[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [logs, setLogs] = useState<Map<string, DayLog>>(new Map());
  const [sync, setSync] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimer = useRef<number | undefined>(undefined);
  const userId = session?.user.id;

  // ---------- auth ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // O refresh token do Google só chega uma vez, logo após o login: guardamos no servidor.
      if (event === 'SIGNED_IN' && s?.provider_refresh_token) {
        const token = s.provider_refresh_token;
        setSync('syncing');
        supabase.functions
          .invoke('google-connect', { body: { refresh_token: token, timezone: browserTimeZone() } })
          .then(({ data, error }) => {
            if (error || data?.syncError) {
              setSync('error');
              setSyncError(error?.message ?? data?.syncError);
            } else setSync('ok');
            loadProfile();
          });
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').maybeSingle();
    if (data) setProfile({ ...data, reminder_time: String(data.reminder_time).slice(0, 5) });
    return data;
  }, []);

  // ---------- carga inicial ----------
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [p, v, s, l] = await Promise.all([
        loadProfile(),
        supabase.from('cycle_versions').select('*'),
        supabase.from('shifts').select('*'),
        supabase.from('day_logs').select('*').gte('date', addMonths(-3)),
      ]);
      if (cancelled) return;
      // Perfil pode demorar um instante a ser criado pelo gatilho no primeiro login.
      if (!p) await new Promise((r) => setTimeout(r, 800)).then(loadProfile);
      setVersions((v.data ?? []).map(toVersion));
      setShifts((s.data ?? []).map(toShift));
      setLogs(new Map((l.data ?? []).map((x: any) => [x.date, { date: x.date, steps: x.steps ?? {}, done: x.done }])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadProfile]);

  // Mantém o fuso do perfil igual ao do aparelho.
  useEffect(() => {
    if (profile && profile.timezone !== browserTimeZone()) {
      supabase.from('profiles').update({ timezone: browserTimeZone() }).eq('user_id', profile.user_id).then(() => {});
      setProfile({ ...profile, timezone: browserTimeZone() });
    }
  }, [profile]);

  const today = todayIn(profile?.timezone ?? browserTimeZone());
  const schedule = useMemo(() => new Schedule(versions, shifts), [versions, shifts]);

  // ---------- sincronização ----------
  const runSync = useCallback(async () => {
    setSync('syncing');
    const { data, error } = await supabase.functions.invoke('google-sync', { body: {} });
    if (error || data?.ok === false) {
      let msg = data?.error ?? error?.message ?? 'Erro ao sincronizar';
      try {
        const ctx = (error as any)?.context;
        if (ctx?.json) msg = (await ctx.json()).error ?? msg;
      } catch { /* ignore */ }
      setSync('error');
      setSyncError(msg);
    } else {
      setSync('ok');
      setSyncError(null);
      // Tarefas concluídas direto no Google voltam como "feito" aqui.
      const { data: l } = await supabase.from('day_logs').select('*').gte('date', addMonths(-3));
      if (l) setLogs(new Map(l.map((x: any) => [x.date, { date: x.date, steps: x.steps ?? {}, done: x.done }])));
    }
    loadProfile();
  }, [loadProfile]);

  // Sincroniza sozinho ao abrir o app (e ao voltar para ele), sem precisar de botão.
  const autoSynced = useRef(0);
  useEffect(() => {
    if (loading || !profile?.google_connected || versions.length === 0) return;
    const maybeSync = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - autoSynced.current < 5 * 60 * 1000) return; // no máximo a cada 5 min
      autoSynced.current = Date.now();
      runSync();
    };
    maybeSync();
    document.addEventListener('visibilitychange', maybeSync);
    return () => document.removeEventListener('visibilitychange', maybeSync);
  }, [loading, profile?.google_connected, versions.length, runSync]);

  const scheduleSync = useCallback(() => {
    window.clearTimeout(syncTimer.current);
    setSync('syncing');
    syncTimer.current = window.setTimeout(runSync, 1200);
  }, [runSync]);

  const syncNow = useCallback(() => {
    window.clearTimeout(syncTimer.current);
    runSync();
  }, [runSync]);

  // ---------- ações ----------
  const signIn = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setVersions([]);
    setShifts([]);
    setLogs(new Map());
  }, []);

  const saveCycle = useCallback(
    async (daDays: number, slots: Slot[], anchorPos: number) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('cycle_versions')
        .insert({ user_id: userId, da_days: daDays, slots, anchor_date: today, anchor_pos: anchorPos })
        .select()
        .single();
      if (error) throw error;
      setVersions((v) => [...v, toVersion(data)]);
      scheduleSync();
    },
    [userId, today, scheduleSync],
  );

  const reschedule = useCallback(
    async (fromDate: string, days: number) => {
      if (!userId) return null;
      const { data, error } = await supabase.from('shifts').insert({ user_id: userId, from_date: fromDate, days }).select().single();
      if (error) throw error;
      setShifts((s) => [...s, toShift(data)]);
      // O dia remarcado deixa de ter checklist.
      await supabase.from('day_logs').delete().eq('user_id', userId).eq('date', fromDate);
      setLogs((m) => {
        const n = new Map(m);
        n.delete(fromDate);
        return n;
      });
      scheduleSync();
      return data.id as string;
    },
    [userId, scheduleSync],
  );

  const removeShift = useCallback(
    async (id: string) => {
      await supabase.from('shifts').delete().eq('id', id);
      setShifts((s) => s.filter((x) => x.id !== id));
      scheduleSync();
    },
    [scheduleSync],
  );

  const setStep = useCallback(
    async (date: string, stepId: string, value: boolean, allIds: string[]) => {
      if (!userId) return;
      const prev = logs.get(date);
      const steps = { ...(prev?.steps ?? {}), [stepId]: value };
      const done = allIds.every((id) => steps[id]);
      const row: DayLog = { date, steps, done };
      setLogs((m) => new Map(m).set(date, row));
      await supabase.from('day_logs').upsert({ user_id: userId, date, steps, done, updated_at: new Date().toISOString() });
      if (done !== (prev?.done ?? false)) scheduleSync();
    },
    [userId, logs, scheduleSync],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!profile) return;
      setProfile({ ...profile, ...patch });
      await supabase.from('profiles').update(patch).eq('user_id', profile.user_id);
      const syncKeys: (keyof Profile)[] = ['sync_mode', 'reminder_time', 'notify_eve', 'products'];
      if (profile.google_connected && Object.keys(patch).some((k) => syncKeys.includes(k as keyof Profile))) scheduleSync();
    },
    [profile, scheduleSync],
  );

  const disconnectGoogle = useCallback(
    async (removeItems: boolean) => {
      await supabase.functions.invoke('google-disconnect', { body: { remove_items: removeItems } });
      setSync('idle');
      await loadProfile();
    },
    [loadProfile],
  );

  const value: Store = {
    session, authReady, loading, profile, versions, shifts, logs, schedule, today,
    sync, syncError: syncError ?? profile?.last_sync_error ?? null,
    signIn, signOut, saveCycle, reschedule, removeShift, setStep, updateProfile, syncNow, disconnectGoogle,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function addMonths(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
