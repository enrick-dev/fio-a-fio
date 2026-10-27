import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

export function SyncChip({ onClick }: { onClick: () => void }) {
  const { sync, profile } = useStore();
  const connected = profile?.google_connected;
  const state = !connected ? 'off' : sync === 'syncing' ? 'syncing' : sync === 'error' || profile?.last_sync_error ? 'error' : 'ok';
  const meta = {
    off: { label: 'Conectar Google', color: 'var(--primary)' },
    syncing: { label: 'Sincronizando', color: 'var(--muted)' },
    error: { label: 'Erro na agenda', color: 'var(--danger)' },
    ok: { label: 'Sincronizado', color: 'var(--ok-fg)' },
  }[state];
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      aria-label={`${meta.label} — abrir ajustes`}
      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', minHeight: 44, borderRadius: 999, background: '#fff', border: '1px solid var(--line)', color: meta.color, fontSize: 12, fontWeight: 700 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} style={{ display: 'flex' }}>
          {state === 'syncing' ? (
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex' }}>
              <Icon name="refresh" size={16} stroke={2.2} />
            </motion.span>
          ) : (
            <Icon name={state === 'ok' ? 'check' : state === 'error' ? 'alert' : 'calendar'} size={16} stroke={2.2} />
          )}
        </motion.span>
      </AnimatePresence>
      {meta.label}
    </motion.button>
  );
}
