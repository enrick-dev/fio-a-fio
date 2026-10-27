import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Schedule, addDays, dayTitle, type CycleVersion, type Shift } from '@shared/schedule.ts';
import { Sheet, tagOf } from './ui';
import { Icon } from './Icon';
import { TYPE_COLORS, spring } from '../lib/theme';
import { WD_SHORT, parts, plural, shortDate } from '../lib/format';
import { useStore } from '../lib/store';

/** "Não fiz neste dia": escolhe em que dia fez/vai fazer e empurra o cronograma. */
export function RescheduleSheet({ date, open, onClose, onDone }: { date: string; open: boolean; onClose: () => void; onDone: (shiftId: string | null, days: number) => void }) {
  const { schedule, versions, shifts, reschedule } = useStore();
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setDays(1); }, [open, date]);

  const info = schedule.day(date);
  const target = addDays(date, days);
  const preview = new Schedule(versions as CycleVersion[], [...(shifts as Shift[]), { fromDate: date, days, createdAt: '9999' }]);
  const startPrev = date;
  const before = schedule.range(startPrev, 7);
  const after = preview.range(startPrev, 7);
  const custom = days > 3;
  const name = info ? dayTitle(info).toLowerCase() : 'lavagem';

  const confirm = async () => {
    setBusy(true);
    try {
      const id = await reschedule(date, days);
      onDone(id, days);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Quando fez (ou vai fazer) a ${name.replace('shampoo + ', '')}?`}>
      <p className="sub" style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
        Tudo de {shortDate(date)} em diante anda junto — no app e no Google. Os dias de espera viram day after extra.
      </p>
      <div role="group" aria-label="Novo dia" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {[1, 2, 3].map((k) => {
          const on = days === k;
          const d = addDays(date, k);
          return (
            <motion.button key={k} aria-pressed={on} onClick={() => setDays(k)} whileTap={{ scale: 0.92 }} animate={{ scale: on ? 1.04 : 1 }} transition={spring}
              style={{
                minHeight: 62, borderRadius: 16, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--line)'}`,
                background: on ? 'var(--primary)' : '#fff', color: on ? '#fff' : 'var(--ink)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, transition: 'background .25s, color .25s',
              }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{k === 1 ? 'Dia seguinte' : `+${k} dias`}</span>
              <span style={{ fontSize: 12 }}>{shortDate(d)}</span>
            </motion.button>
          );
        })}
      </div>
      <label className="between" style={{
        minHeight: 56, padding: '0 8px 0 14px', borderRadius: 16, fontSize: 15, fontWeight: 700,
        border: `1.5px solid ${custom ? 'var(--primary)' : 'var(--line)'}`, background: custom ? 'var(--primary)' : '#fff', color: custom ? '#fff' : 'var(--ink)',
        transition: 'background .25s, color .25s',
      }}>
        <span className="row" style={{ gap: 8 }}><Icon name="calendar" size={18} /> Outra data</span>
        <input type="date" className="field" min={addDays(date, 1)} value={target}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const k = Math.round((Date.parse(v) - Date.parse(date)) / 86400000);
            if (k >= 1) setDays(k);
          }} />
      </label>

      <div className="card" style={{ padding: 14, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[{ label: 'Antes', list: before }, { label: 'Depois', list: after }].map((row) => (
          <div key={row.label} className="row" style={{ gap: 8 }}>
            <span style={{ width: 48, flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{row.label}</span>
            <div className="grid7" style={{ flex: 1 }}>
              {row.list.map((d, i) => {
                const c = TYPE_COLORS[d.type];
                return (
                  <motion.span key={`${row.label}-${i}-${d.type}`} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: i * 0.03 }}
                    style={{ height: 30, borderRadius: 8, background: c.bg, color: c.fg, border: c.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                    {tagOf(d)}
                  </motion.span>
                );
              })}
            </div>
          </div>
        ))}
        <div className="row" style={{ gap: 8 }} aria-hidden="true">
          <span style={{ width: 48, flexShrink: 0 }} />
          <div className="grid7" style={{ flex: 1 }}>
            {before.map((d) => (
              <span key={d.date} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{WD_SHORT[parts(d.date).wd]}</span>
            ))}
          </div>
        </div>
      </div>

      <button className="btn block" disabled={busy} onClick={confirm}>
        {busy ? 'Movendo…' : `Mover cronograma +${plural(days, 'dia', 'dias')}`}
      </button>
      <button className="btn ghost" onClick={onClose}>Cancelar</button>
    </Sheet>
  );
}
