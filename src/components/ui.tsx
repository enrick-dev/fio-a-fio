import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useId, type ReactNode } from 'react';
import type { DayInfo, DayType } from '@shared/schedule.ts';
import { TYPE_META } from '@shared/schedule.ts';
import { TYPE_COLORS, spring } from '../lib/theme';
import { Icon } from './Icon';

// ---------- Selo de tipo ----------
export function TypeBadge({ type, detox, label, size = 'md' }: { type: DayType; detox?: boolean; label?: string; size?: 'sm' | 'md' }) {
  const c = TYPE_COLORS[type];
  return (
    <span
      className="chip"
      style={{
        background: c.bg, color: c.fg, border: c.border, fontWeight: 800,
        ...(size === 'sm' ? { padding: '2px 8px', fontSize: 11 } : {}),
      }}
    >
      {label ?? TYPE_META[type].tag + (detox ? '+D' : '')}
    </span>
  );
}

export function tagOf(d: Pick<DayInfo, 'type' | 'detox'>) {
  return TYPE_META[d.type].tag + (d.detox ? '+D' : '');
}

// ---------- Anel de progresso ----------
export function Ring({ value, total, size = 76, label }: { value: number; total: number; size?: number; label: string }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const pct = total ? Math.min(1, value / total) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--plum-3)" strokeWidth={8} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pink)" strokeWidth={8} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <motion.span
        key={value}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontSize: size * 0.32, fontWeight: 800 }}
      >
        {value}
      </motion.span>
    </div>
  );
}

// ---------- Switch ----------
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <motion.span className="knob" animate={{ x: checked ? 18 : 0 }} transition={spring} />
    </button>
  );
}

// ---------- Bottom sheet com arrastar para fechar ----------
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const controls = useDragControls();
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <button aria-label="Fechar" onClick={onClose} style={{ flex: 1, border: 'none', background: 'transparent' }} />
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby={id}
            className="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y" dragControls={controls} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
          >
            <div onPointerDown={(e) => controls.start(e)} style={{ padding: '6px 0 2px', display: 'flex', justifyContent: 'center', touchAction: 'none', cursor: 'grab' }}>
              <span className="grabber" />
            </div>
            <h2 id={id} className="h1" style={{ fontSize: 24 }}>{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Toast ----------
export function Toast({ message, action, onAction, onDone }: { message: string | null; action?: string; onAction?: () => void; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="toast" role="status"
          initial={{ y: 40, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={spring}
        >
          <Icon name="check" color="var(--pink)" stroke={2.6} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{message}</span>
          {action && (
            <button className="btn link" style={{ color: 'var(--pink)' }} onClick={() => { onAction?.(); onDone(); }}>
              {action}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Fade/slide de entrada com atraso ----------
export function Rise({ delay = 0, children, style, className, as = 'div' }: { delay?: number; children: ReactNode; style?: React.CSSProperties; className?: string; as?: 'div' | 'section' | 'header' }) {
  const C = motion[as];
  return (
    <C className={className} style={style} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay }}>
      {children}
    </C>
  );
}
