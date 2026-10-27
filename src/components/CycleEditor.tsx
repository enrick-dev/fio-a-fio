import { AnimatePresence, motion } from 'framer-motion';
import { TYPE_META, buildPositions, type Slot, type WashType } from '@shared/schedule.ts';
import { TYPE_COLORS, spring } from '../lib/theme';
import { Icon } from './Icon';

const WASHES: WashType[] = ['lav', 'h', 'n', 'r'];

export const DEFAULT_SLOTS: Slot[] = [
  { type: 'lav', detox: false },
  { type: 'h', detox: false },
  { type: 'lav', detox: false },
  { type: 'n', detox: false },
  { type: 'lav', detox: false },
  { type: 'r', detox: true },
];

export function CycleEditor({
  daDays, slots, onDaDays, onSlots,
}: { daDays: number; slots: Slot[]; onDaDays: (n: number) => void; onSlots: (s: Slot[]) => void }) {
  const total = buildPositions(daDays, slots);
  const update = (i: number, patch: Partial<Slot>) => onSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <>
      <section className="card between" style={{ padding: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dias de day after</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>Entre uma lavagem e outra</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <motion.button whileTap={{ scale: 0.88 }} className="icon-btn" style={{ background: 'var(--bg)', fontSize: 22, fontWeight: 700 }}
            aria-label="Diminuir dias de day after" onClick={() => onDaDays(Math.max(0, daDays - 1))}>−</motion.button>
          <output aria-live="polite" style={{ minWidth: 28, textAlign: 'center', fontFamily: 'var(--display)', fontSize: 28, fontWeight: 800, display: 'inline-block' }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={daDays} style={{ display: 'inline-block' }} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={spring}>
                {daDays}
              </motion.span>
            </AnimatePresence>
          </output>
          <motion.button whileTap={{ scale: 0.88 }} className="icon-btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 22, fontWeight: 700 }}
            aria-label="Aumentar dias de day after" onClick={() => onDaDays(Math.min(10, daDays + 1))}>+</motion.button>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="between" style={{ alignItems: 'baseline' }}>
          <h2 className="h2">Lavagens do ciclo</h2>
          <span className="sub">em ordem</span>
        </div>
        <AnimatePresence initial={false}>
          {slots.map((s, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, height: 0, marginTop: -10 }}
              transition={spring}
              className="card"
              style={{ borderRadius: 20, padding: '10px 10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}
            >
              <div className="between">
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                  {i + 1}ª lavagem · depois de {daDays} {daDays === 1 ? 'dia' : 'dias'} de day after
                </span>
                {slots.length > 1 && (
                  <button aria-label={`Remover lavagem ${i + 1}`} onClick={() => onSlots(slots.filter((_, j) => j !== i))}
                    style={{ width: 40, height: 32, border: 'none', background: 'none', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {WASHES.map((t) => {
                  const on = s.type === t;
                  const c = TYPE_COLORS[t];
                  return (
                    <motion.button
                      key={t}
                      aria-pressed={on}
                      aria-label={TYPE_META[t].name}
                      onClick={() => update(i, { type: t })}
                      whileTap={{ scale: 0.88 }}
                      animate={{ scale: on ? 1.06 : 1 }}
                      transition={spring}
                      style={{
                        height: 44, minWidth: 44, padding: '0 10px', borderRadius: 14,
                        border: `1.5px solid ${on ? c.fg : 'var(--line)'}`,
                        background: on ? c.bg : '#fff', color: on ? c.fg : 'var(--muted)',
                        fontSize: 14, fontWeight: 800, transition: 'background .25s, color .25s, border-color .25s',
                      }}
                    >
                      {TYPE_META[t].tag}
                    </motion.button>
                  );
                })}
                <span style={{ flex: 1 }} />
                <motion.button
                  aria-pressed={s.detox}
                  onClick={() => update(i, { detox: !s.detox })}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    height: 44, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--line)',
                    background: s.detox ? 'var(--plum)' : '#fff', color: s.detox ? '#fff' : 'var(--muted)',
                    fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, transition: 'background .25s, color .25s',
                  }}
                >
                  <Icon name="detox" size={16} /> Detox
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.button layout whileTap={{ scale: 0.96 }} className="btn dashed" onClick={() => onSlots([...slots, { type: 'lav', detox: false }])}>
          <Icon name="plus" size={18} stroke={2.4} /> Adicionar lavagem
        </motion.button>
      </section>

      <section className="hero" style={{ gap: 12 }}>
        <div className="between" style={{ alignItems: 'baseline' }}>
          <h2 className="h2">Seu ciclo</h2>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pink)' }}>{total.length} dias · repete</span>
        </div>
        <div role="img" aria-label={`Ciclo de ${total.length} dias com ${slots.length} lavagens`} style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {total.map((p, i) => {
            const c = p.type === 'da' ? { bg: 'var(--plum-3)', fg: 'var(--blush)' } : TYPE_COLORS[p.type];
            return (
              <motion.span
                key={`${i}-${p.type}-${p.detox}`}
                initial={{ scale: 0, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ ...spring, delay: Math.min(i * 0.015, 0.5) }}
                style={{ width: 26, height: 26, borderRadius: 8, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {TYPE_META[p.type].tag + (p.detox ? '+D' : '')}
              </motion.span>
            );
          })}
        </div>
      </section>
    </>
  );
}
