import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TYPE_META, dayTitle, daySteps, isWash, formatDate, parseDate } from '@shared/schedule.ts';
import { useStore } from '../lib/store';
import { Rise, Toast, TypeBadge, tagOf } from '../components/ui';
import { Icon } from '../components/Icon';
import { RescheduleSheet } from '../components/RescheduleSheet';
import { TYPE_COLORS, spring } from '../lib/theme';
import { MONTHS, cap, longDate, parts, plural } from '../lib/format';

const LEGEND = ['da', 'lav', 'h', 'n', 'r', 'wait'] as const;

export function Agenda() {
  const { schedule, today, logs, profile, removeShift } = useStore();
  const t = parts(today);
  const [month, setMonth] = useState({ y: t.y, m: t.m });
  const [dir, setDir] = useState(0);
  const [sel, setSel] = useState(today);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<{ msg: string; shiftId: string | null } | null>(null);

  const cells = useMemo(() => {
    const first = Date.UTC(month.y, month.m, 1) / 86400000;
    const dim = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
    const lead = new Date(first * 86400000).getUTCDay();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let i = 0; i < dim; i++) out.push(formatDate(first + i));
    return out;
  }, [month]);

  const shiftMonth = (k: number) => {
    setDir(k);
    setMonth(({ y, m }) => {
      const n = m + k;
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });
  };

  const info = schedule.day(sel);
  const past = sel < today;
  const isToday = sel === today;
  const log = logs.get(sel);
  const wash = info ? isWash(info.type) : false;
  const canSkip = info && wash && (past || isToday) && !(isToday && log?.done);
  let status = 'Agendado';
  let statusColor = 'var(--blush)';
  if (!info) status = 'Antes do cronograma';
  else if (info.type === 'wait') { status = 'Remarcado'; statusColor = 'var(--pink)'; }
  else if (wash && (past || log?.done)) { status = '✓ Feito'; statusColor = '#9FE0D6'; }
  else if (past) status = 'Passou';
  else if (isToday) { status = 'Hoje · pendente'; statusColor = 'var(--pink)'; }

  return (
    <div className="screen" style={{ gap: 18 }}>
      <Rise as="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p className="eyebrow">Seu cronograma</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1 key={`${month.y}-${month.m}`} className="h1" initial={{ opacity: 0, y: dir * 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -dir * 12 }} transition={{ duration: 0.2 }}>
              {cap(MONTHS[month.m])} {month.y}
            </motion.h1>
          </AnimatePresence>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <motion.button whileTap={{ scale: 0.88 }} className="icon-btn" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}><Icon name="left" size={20} stroke={2.2} /></motion.button>
          <motion.button whileTap={{ scale: 0.88 }} className="icon-btn" aria-label="Próximo mês" onClick={() => shiftMonth(1)}><Icon name="right" size={20} stroke={2.2} /></motion.button>
        </div>
      </Rise>

      <Rise delay={0.06} className="card" style={{ borderRadius: 28, padding: '16px 12px', overflow: 'hidden' }}>
        <div className="grid7" aria-hidden="true" style={{ marginBottom: 8 }}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <span key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{d}</span>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${month.y}-${month.m}`} className="grid7"
            initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 40 }} transition={{ duration: 0.25 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, i) => { if (i.offset.x < -60) shiftMonth(1); else if (i.offset.x > 60) shiftMonth(-1); }}
          >
            {cells.map((date, i) => {
              if (!date) return <div key={`b${i}`} style={{ height: 44 }} aria-hidden="true" />;
              const d = schedule.day(date);
              const c = d ? TYPE_COLORS[d.type] : null;
              const w = d ? d.type !== 'da' : false;
              const on = date === sel;
              return (
                <motion.button
                  key={date}
                  aria-pressed={on}
                  aria-label={`${parts(date).d} de ${MONTHS[month.m]}${d ? ', ' + dayTitle(d) : ''}`}
                  onClick={() => setSel(date)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: date < today ? 0.62 : 1, scale: on ? 1.08 : 1, boxShadow: on ? '0 0 0 2px #C42D66' : '0 0 0 0px #C42D66' }}
                  transition={{ ...spring, delay: dir === 0 ? i * 0.008 : 0 }}
                  whileTap={{ scale: 0.88 }}
                  style={{
                    height: 44, padding: 0, borderRadius: 14, border: c?.border ?? 'none',
                    background: w && c ? c.bg : '#fff', color: c ? (w ? c.fg : '#9C2E57') : 'var(--muted)',
                    outline: date === today ? '2px solid var(--ink)' : 'none', outlineOffset: -2,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{parts(date).d}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1 }}>{d ? tagOf(d) : ''}</span>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </Rise>

      <Rise delay={0.12} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEGEND.map((k) => (
          <TypeBadge key={k} type={k} label={`${TYPE_META[k].tag} · ${TYPE_META[k].short}`} />
        ))}
      </Rise>

      <AnimatePresence mode="wait">
        <motion.section key={sel + (info?.type ?? '')} aria-live="polite"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ ...spring }}
          className="hero" style={{ gap: 14 }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: 'var(--blush)' }}>{longDate(sel)}</span>
              <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                {info ? dayTitle(info) : 'Sem cronograma'}
              </h2>
            </div>
            {info && <TypeBadge type={info.type} detox={info.detox} />}
          </div>
          <span className="chip" style={{ alignSelf: 'flex-start', background: 'var(--plum-3)', color: statusColor }}>{status}</span>
          {info && (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {daySteps(info, profile?.products).map((s, i) => (
                <li key={s.id} className="row" style={{ gap: 10, fontSize: 14 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--plum-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span>{s.label}<span style={{ color: 'var(--blush)' }}> — {s.sub}</span></span>
                </li>
              ))}
            </ol>
          )}
          {canSkip && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setSheet(true)}
              style={{ minHeight: 48, borderRadius: 14, border: '1.5px solid #8A3D63', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="undo" size={18} stroke={2.2} /> Não fiz neste dia
            </motion.button>
          )}
          {info && (
            <div className="row" style={{ gap: 8, paddingTop: 12, borderTop: '1px solid var(--plum-3)', fontSize: 13, color: 'var(--blush)' }}>
              <Icon name="calendar" size={16} />
              {info.pos >= 0 ? `Dia ${info.pos + 1} de ${info.cycleLength}` : 'Dia de espera'}
              {profile?.google_connected ? ` · ${profile.sync_mode === 'events' ? 'evento' : 'tarefa'} no Google` : ''}
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <RescheduleSheet
        date={sel}
        open={sheet}
        onClose={() => setSheet(false)}
        onDone={(id, days) => {
          setSheet(false);
          const target = formatDate(parseDate(sel) + days);
          setSel(target);
          setToast({ msg: `Movido +${plural(days, 'dia', 'dias')} a partir de ${parts(sel).d}/${parts(sel).m + 1}`, shiftId: id });
        }}
      />
      <Toast message={toast?.msg ?? null} action={toast?.shiftId ? 'Desfazer' : undefined}
        onAction={() => toast?.shiftId && removeShift(toast.shiftId)} onDone={() => setToast(null)} />
    </div>
  );
}
