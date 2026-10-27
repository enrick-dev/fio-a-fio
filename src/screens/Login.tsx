import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { APP_NAME } from '../config';
import { Icon } from '../components/Icon';
import { TYPE_COLORS } from '../lib/theme';

const DEMO = ['da', 'da', 'lav', 'da', 'da', 'h', 'da', 'da', 'lav', 'da', 'da', 'n', 'da', 'da', 'lav', 'da', 'da', 'r'] as const;
const TAG: Record<string, string> = { da: 'DA', lav: 'S/C', h: 'H', n: 'N', r: 'R' };

export function Login() {
  const { signIn } = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <div className="screen" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 24 }}>
        <motion.img src="/icon.svg" alt="" width={72} height={72} style={{ borderRadius: 20 }}
          initial={{ scale: 0.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
          <h1 className="h1" style={{ fontSize: 40 }}>{APP_NAME}</h1>
          <p className="muted" style={{ fontSize: 17, lineHeight: 1.45, margin: '10px 0 0' }}>
            Seu cronograma capilar no automático: day after, hidratação, nutrição e reconstrução direto no seu Google Agenda.
          </p>
        </motion.div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} aria-hidden="true">
          {DEMO.map((t, i) => (
            <motion.span key={i}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 + i * 0.04 }}
              style={{ width: 38, height: 38, borderRadius: 11, background: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
              {TAG[t]}
            </motion.span>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn block" disabled={busy} onClick={() => { setBusy(true); signIn().catch(() => setBusy(false)); }}>
          {busy ? 'Abrindo o Google…' : 'Entrar com Google'} <Icon name="arrow" size={18} />
        </button>
        <p className="sub" style={{ margin: 0, textAlign: 'center', lineHeight: 1.45 }}>
          Pedimos acesso só para criar a agenda “{APP_NAME}” e a lista de tarefas do seu cronograma.
        </p>
      </motion.div>
    </div>
  );
}
