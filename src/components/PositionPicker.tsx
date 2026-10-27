import { motion } from 'framer-motion';
import { TYPE_META, buildPositions, dayTitle, type Slot } from '@shared/schedule.ts';
import { TYPE_COLORS, spring } from '../lib/theme';
import { plural } from '../lib/format';

/** Grade para escolher em que dia do ciclo a pessoa está hoje. */
export function PositionPicker({ daDays, slots, value, onChange }: { daDays: number; slots: Slot[]; value: number; onChange: (n: number) => void }) {
  const positions = buildPositions(daDays, slots);
  const pos = Math.min(value, positions.length - 1);
  const cur = positions[pos];
  let daysToWash = 0;
  for (let k = 1; k <= positions.length; k++) {
    if (positions[(pos + k) % positions.length].type !== 'da') { daysToWash = k; break; }
  }
  const next = positions[(pos + daysToWash) % positions.length];
  const curInfo = { ...cur, daTotal: daDays };
  const nextInfo = { ...next, daTotal: daDays };
  const c = TYPE_COLORS[cur.type];

  return (
    <>
      <div role="group" aria-label="Dia do ciclo de hoje" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
        {positions.map((p, i) => {
          const on = i === pos;
          const pc = TYPE_COLORS[p.type];
          return (
            <motion.button
              key={i}
              aria-pressed={on}
              aria-label={`Dia ${i + 1}: ${dayTitle({ ...p, daTotal: daDays })}`}
              onClick={() => onChange(i)}
              whileTap={{ scale: 0.88 }}
              animate={{ scale: on ? 1.08 : 1 }}
              transition={spring}
              style={{
                height: 48, borderRadius: 12, border: `2px solid ${on ? 'var(--ink)' : 'transparent'}`,
                background: pc.bg, color: pc.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800 }}>{TYPE_META[p.type].tag + (p.detox ? '+D' : '')}</span>
              <span style={{ fontSize: 9, fontWeight: 700 }}>dia {i + 1}</span>
            </motion.button>
          );
        })}
      </div>
      <motion.div layout className="card row" style={{ padding: '12px 14px', borderRadius: 16 }} aria-live="polite">
        <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
          {TYPE_META[cur.type].tag + (cur.detox ? '+D' : '')}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13, color: 'var(--muted)' }}>
          <strong style={{ fontSize: 15, color: 'var(--ink)' }}>Hoje: {dayTitle(curInfo)}</strong>
          Próxima lavagem: {dayTitle(nextInfo).toLowerCase()} em {plural(daysToWash, 'dia', 'dias')}
        </span>
      </motion.div>
    </>
  );
}
