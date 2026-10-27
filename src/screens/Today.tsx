import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TYPE_META, addDays, dayTitle, daySteps, isWash } from '@shared/schedule.ts';
import { useStore } from '../lib/store';
import { Rise, Ring, Toast, TypeBadge, tagOf } from '../components/ui';
import { Icon } from '../components/Icon';
import { SyncChip } from '../components/SyncChip';
import { InstallCard } from '../components/InstallCard';
import { RescheduleSheet } from '../components/RescheduleSheet';
import { TYPE_COLORS, spring } from '../lib/theme';
import { WD_SHORT, cap, longDate, parts, plural } from '../lib/format';
import type { Tab } from '../components/TabBar';

export function Today({ go }: { go: (t: Tab) => void }) {
  const { schedule, today, logs, profile, setStep, removeShift } = useStore();
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<{ msg: string; shiftId: string | null } | null>(null);

  const info = schedule.day(today);
  if (!info) return null;
  const steps = daySteps(info, profile?.products);
  const log = logs.get(today);
  const doneCount = steps.filter((s) => log?.steps[s.id]).length;
  const allDone = doneCount === steps.length;
  const wash = isWash(info.type);
  const next = schedule.nextWash(today);
  const daysToNext = next ? Math.round((Date.parse(next.date) - Date.parse(today)) / 86400000) : 0;
  const upcoming = schedule.range(addDays(today, 1), 10);

  const headline = info.type === 'wait' ? 'Dia de descanso' : info.type === 'da' ? 'Dia de day after' : `Dia de ${TYPE_META[info.type].short.toLowerCase()}`;
  const heroSub =
    info.type === 'wait'
      ? 'Lavagem remarcada — o resto do ciclo veio junto'
      : next
        ? `Ciclo ${info.cycleNumber} · ${dayTitle(next)} ${daysToNext === 1 ? 'amanhã' : `em ${daysToNext} dias`}`
        : `Ciclo ${info.cycleNumber}`;

  return (
    <div className="screen">
      <Rise as="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{longDate(today)}</p>
          <h1 className="h1">{headline}</h1>
        </div>
        <SyncChip onClick={() => go('settings')} />
      </Rise>

      <Rise delay={0.08} className="hero">
        <span className="blob" aria-hidden="true" />
        <div className="between">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
            <TypeBadge type={info.type} detox={info.detox} label={`${tagOf(info)} · ${TYPE_META[info.type].short}`} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--blush)' }}>
              {info.pos >= 0 ? `Dia ${info.pos + 1} de ${info.cycleLength} do ciclo` : 'Dia extra'}
            </span>
          </div>
          <Ring value={info.pos >= 0 ? info.pos + 1 : 0} total={info.cycleLength} label={`Dia ${info.pos + 1} de ${info.cycleLength}`} />
        </div>
        <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 24, lineHeight: 1.15, fontWeight: 700, overflowWrap: 'anywhere' }}>{dayTitle(info)}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--blush)', overflowWrap: 'anywhere' }}>{heroSub}</p>
      </Rise>

      {info.type !== 'wait' && (
        <Rise delay={0.16} as="section" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="between" style={{ alignItems: 'baseline' }}>
            <h3 className="h2">{wash ? 'Ritual de hoje' : 'Cuidados de hoje'}</h3>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{doneCount} de {steps.length}</span>
          </div>
          {steps.map((s, i) => {
            const on = !!log?.steps[s.id];
            return (
              <motion.button
                key={s.id}
                aria-pressed={on}
                onClick={() => setStep(today, s.id, !on, steps.map((x) => x.id))}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0, backgroundColor: on ? '#FDEBF1' : '#FFFFFF', borderColor: on ? '#F3C2D3' : '#F3D9E2' }}
                transition={{ ...spring, delay: 0.2 + i * 0.06, backgroundColor: { duration: 0.3 }, borderColor: { duration: 0.3 } }}
                whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, padding: '14px 16px', textAlign: 'left', border: '1px solid', borderRadius: 20 }}
              >
                <motion.span
                  animate={{ backgroundColor: on ? '#C42D66' : 'rgba(0,0,0,0)', borderColor: on ? '#C42D66' : '#E6A9BF', scale: on ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <AnimatePresence>
                    {on && (
                      <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }} style={{ display: 'flex' }}>
                        <Icon name="check" size={16} stroke={3} color="#fff" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, textDecoration: on ? 'line-through' : 'none', textDecorationColor: 'var(--primary)' }}>{s.label}</span>
                  <span className="sub">{s.sub}</span>
                </span>
              </motion.button>
            );
          })}
          <AnimatePresence>
            {allDone && wash && (
              <motion.div role="status" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="row" style={{ padding: '14px 16px', borderRadius: 20, background: 'var(--primary)', color: '#fff' }}>
                <motion.span animate={{ rotate: [0, 20, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.8 }} style={{ display: 'flex' }}>
                  <Icon name="sparkle" size={26} />
                </motion.span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 15 }}>Ritual concluído!</strong>
                  <span style={{ fontSize: 13, color: '#FDEBF1' }}>{profile?.google_connected ? 'Marcado como feito no Google também' : 'Bom trabalho, fio a fio'}</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {wash && !allDone && (
            <motion.button whileTap={{ scale: 0.96 }} className="btn dashed" onClick={() => setSheet(true)}>
              <Icon name="undo" size={18} stroke={2.2} /> Não consegui fazer hoje
            </motion.button>
          )}
        </Rise>
      )}

      <InstallCard compact />

      <Rise delay={0.24} as="section" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="between">
          <h3 className="h2">Próximos dias</h3>
          <button className="btn link" style={{ textDecoration: 'none', fontWeight: 700 }} onClick={() => go('agenda')}>Ver agenda</button>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -20px', padding: '2px 20px 8px', scrollSnapType: 'x mandatory' }}>
          {upcoming.map((d, i) => {
            const p = parts(d.date);
            const c = TYPE_COLORS[d.type];
            return (
              <motion.div key={d.date + d.type}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 + i * 0.05 }}
                whileHover={{ y: -4 }}
                className="card" style={{ flexShrink: 0, width: 96, padding: 12, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 8, scrollSnapAlign: 'start' }}>
                <span className="sub" style={{ fontSize: 12, fontWeight: 500 }}>{i === 0 ? 'Amanhã' : WD_SHORT[p.wd]}</span>
                <span style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{p.d}</span>
                <span className="chip" style={{ alignSelf: 'flex-start', background: c.bg, color: c.fg, border: c.border, fontWeight: 800 }}>{tagOf(d)}</span>
                <span style={{ fontSize: 12, lineHeight: 1.3, fontWeight: 500 }}>{cap(dayTitle(d))}</span>
              </motion.div>
            );
          })}
        </div>
      </Rise>

      <RescheduleSheet
        date={today}
        open={sheet}
        onClose={() => setSheet(false)}
        onDone={(id, days) => {
          setSheet(false);
          setToast({ msg: `Cronograma movido +${plural(days, 'dia', 'dias')}`, shiftId: id });
        }}
      />
      <Toast
        message={toast?.msg ?? null}
        action={toast?.shiftId ? 'Desfazer' : undefined}
        onAction={() => toast?.shiftId && removeShift(toast.shiftId)}
        onDone={() => setToast(null)}
      />
    </div>
  );
}
