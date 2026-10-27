import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { spring } from '../lib/theme';

export type Tab = 'today' | 'agenda' | 'cycle' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Hoje', icon: 'drop' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'cycle', label: 'Ciclo', icon: 'cycle' },
  { id: 'settings', label: 'Ajustes', icon: 'sliders' },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {TABS.map((t) => (
        <motion.button
          key={t.id}
          className="tab"
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
          whileTap={{ scale: 0.92 }}
        >
          {tab === t.id && <motion.span layoutId="tab-pill" className="pill" transition={spring} />}
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </motion.button>
      ))}
    </nav>
  );
}
