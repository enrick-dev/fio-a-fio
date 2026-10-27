import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { Rise, Sheet, Switch } from '../components/ui';
import { Icon } from '../components/Icon';
import { TYPE_COLORS, spring } from '../lib/theme';
import { APP_NAME } from '../config';
import type { Products } from '@shared/schedule.ts';

const PRODUCTS: { key: keyof Products; tag: string; name: string; ph: string; bg: string; fg: string }[] = [
  { key: 'lav', tag: 'S/C', name: 'Shampoo e condicionador', ph: 'nome do shampoo', ...TYPE_COLORS.lav },
  { key: 'h', tag: 'H', name: 'Máscara de hidratação', ph: 'nome da máscara', ...TYPE_COLORS.h },
  { key: 'n', tag: 'N', name: 'Máscara de nutrição', ph: 'nome da máscara', ...TYPE_COLORS.n },
  { key: 'r', tag: 'R', name: 'Máscara de reconstrução', ph: 'nome da máscara', ...TYPE_COLORS.r },
  { key: 'detox', tag: 'D', name: 'Detox quelante', ph: 'nome do produto', bg: '#4A1630', fg: '#FFFFFF' },
];

export function Settings() {
  const { profile, sync, syncError, signIn, signOut, updateProfile, syncNow, disconnectGoogle, session } = useStore();
  const [products, setProducts] = useState<Products>(profile?.products ?? {});
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setProducts(profile?.products ?? {}); }, [profile?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;
  const connected = profile.google_connected;
  const lastSync = profile.last_synced_at ? new Date(profile.last_synced_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

  return (
    <div className="screen">
      <Rise as="header">
        <p className="eyebrow">Preferências</p>
        <h1 className="h1">Ajustes</h1>
      </Rise>

      <Rise delay={0.06} className="hero">
        <span className="blob" aria-hidden="true" />
        <div className="row">
          <span style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--plum-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="calendar" size={24} color="var(--pink)" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700 }}>Google Agenda</h2>
            <span style={{ fontSize: 13, color: 'var(--blush)', overflowWrap: 'anywhere' }}>
              {!connected ? 'Não conectado' : sync === 'syncing' ? 'Sincronizando…' : syncError ? 'Com erro' : lastSync ? `Sincronizado em ${lastSync}` : 'Conectado'}
            </span>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {connected ? (
            <motion.div key="on" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--plum-3)', gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ok-bg)', color: 'var(--ok-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="check" size={16} stroke={3} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13, minWidth: 0 }}>
                  <strong style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{profile.google_email ?? session?.user.email}</strong>
                  <span style={{ color: 'var(--blush)' }}>{profile.sync_mode === 'events' ? `Agenda “${APP_NAME}”` : `Lista de tarefas “${APP_NAME}”`}</span>
                </span>
              </div>
              {syncError && (
                <p role="alert" style={{ margin: 0, fontSize: 13, color: '#FFD3DC', lineHeight: 1.4 }}>{syncError}</p>
              )}
              <div className="row" style={{ gap: 8 }}>
                <button className="btn light" style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={syncNow} disabled={sync === 'syncing'}>
                  <Icon name="refresh" size={18} /> Sincronizar agora
                </button>
                <button className="btn link" style={{ color: 'var(--pink)' }} onClick={() => setConfirmOff(true)}>Desconectar</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--blush)' }}>
                Cada dia do cronograma vira uma tarefa ou evento na sua agenda. Ao marcar como feito aqui, ele é concluído lá também.
              </p>
              {syncError && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#FFD3DC' }}>{syncError}</p>}
              <button className="btn light block" onClick={signIn}>Conectar conta Google <Icon name="arrow" size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </Rise>

      <Rise delay={0.12} as="section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="h2">Sincronização</h2>
        <div className="card" style={{ padding: '4px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0 14px' }}>
            <span id="kind-label" style={{ fontSize: 15, fontWeight: 500 }}>Adicionar como</span>
            <div role="group" aria-labelledby="kind-label" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 14, background: 'var(--primary-soft)' }}>
              {(['tasks', 'events'] as const).map((k) => {
                const on = profile.sync_mode === k;
                return (
                  <button key={k} aria-pressed={on} onClick={() => updateProfile({ sync_mode: k })}
                    style={{ position: 'relative', height: 44, border: 'none', borderRadius: 11, background: 'transparent', color: on ? 'var(--primary)' : 'var(--muted)', fontSize: 14, fontWeight: 700 }}>
                    {on && <motion.span layoutId="seg" transition={spring} style={{ position: 'absolute', inset: 0, borderRadius: 11, background: '#fff', boxShadow: '0 2px 8px rgba(74,22,48,.12)' }} />}
                    <span style={{ position: 'relative' }}>{k === 'tasks' ? 'Tarefas' : 'Eventos'}</span>
                  </button>
                );
              })}
            </div>
            <span className="sub">
              {profile.sync_mode === 'tasks'
                ? 'Aparecem no Google Agenda com caixinha de concluir. O Google não permite horário de lembrete em tarefas.'
                : `Eventos de 30 min numa agenda “${APP_NAME}”, com cor por tipo e lembrete no horário abaixo.`}
            </span>
          </div>
          <label className="list-row" style={{ borderTop: '1px solid var(--line)' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15, fontWeight: 500 }}>Horário<span className="sub">dos eventos de lavagem</span></span>
            <input type="time" className="field" value={profile.reminder_time} disabled={profile.sync_mode === 'tasks'}
              onChange={(e) => e.target.value && updateProfile({ reminder_time: e.target.value })} />
          </label>
          <div className="list-row">
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15, fontWeight: 500 }}>Incluir dias de day after<span className="sub">Mostra também os dias sem lavar</span></span>
            <Switch checked={profile.include_da} onChange={(v) => updateProfile({ include_da: v })} label="Incluir dias de day after" />
          </div>
          <div className="list-row">
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15, fontWeight: 500 }}>Avisar na véspera<span className="sub">Lembrete às 20h do dia anterior (eventos)</span></span>
            <Switch checked={profile.notify_eve} onChange={(v) => updateProfile({ notify_eve: v })} label="Avisar na véspera" />
          </div>
        </div>
      </Rise>

      <Rise delay={0.18} as="section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <h2 className="h2">Meus produtos</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>Aparecem nos passos e na descrição de cada tarefa</p>
        </div>
        <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PRODUCTS.map((p) => (
            <label key={p.key} className="row">
              <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: p.bg, color: p.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{p.tag}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{p.name}</span>
                <input type="text" className="field" style={{ width: '100%' }} placeholder={p.ph} value={products[p.key] ?? ''}
                  onChange={(e) => setProducts({ ...products, [p.key]: e.target.value })}
                  onBlur={() => JSON.stringify(products) !== JSON.stringify(profile.products) && updateProfile({ products })} />
              </span>
            </label>
          ))}
        </div>
      </Rise>

      <button className="btn ghost" onClick={signOut}><Icon name="logout" size={18} /> Sair da conta</button>

      <Sheet open={confirmOff} onClose={() => setConfirmOff(false)} title="Desconectar o Google?">
        <p className="sub" style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>O app continua funcionando; só para de atualizar sua agenda.</p>
        <button className="btn block" disabled={busy} onClick={async () => { setBusy(true); await disconnectGoogle(true); setBusy(false); setConfirmOff(false); }}>
          Desconectar e apagar itens futuros
        </button>
        <button className="btn block light" style={{ border: '1px solid var(--line)' }} disabled={busy} onClick={async () => { setBusy(true); await disconnectGoogle(false); setBusy(false); setConfirmOff(false); }}>
          Desconectar e manter na agenda
        </button>
        <button className="btn ghost" onClick={() => setConfirmOff(false)}>Cancelar</button>
      </Sheet>
    </div>
  );
}
