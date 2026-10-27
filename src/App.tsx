import { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { StoreProvider, useStore } from './lib/store';
import { configured } from './lib/supabase';
import { TabBar, type Tab } from './components/TabBar';
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Agenda } from './screens/Agenda';
import { Cycle } from './screens/Cycle';
import { Settings } from './screens/Settings';

const ORDER: Tab[] = ['today', 'agenda', 'cycle', 'settings'];

function Shell() {
  const { authReady, session, loading, schedule } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [dir, setDir] = useState(0);

  if (!configured) {
    return (
      <div className="screen center">
        <h1 className="h1">Falta configurar</h1>
        <p className="muted">Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).</p>
      </div>
    );
  }
  if (!authReady || (session && loading)) {
    return (
      <div className="screen center" style={{ alignItems: 'center' }} aria-busy="true">
        <div className="spinner" role="status" aria-label="Carregando" />
      </div>
    );
  }
  if (!session) return <Login />;
  if (!schedule.hasConfig) return <Onboarding />;

  const go = (t: Tab) => {
    setDir(ORDER.indexOf(t) > ORDER.indexOf(tab) ? 1 : -1);
    setTab(t);
  };

  return (
    <>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={tab}
          custom={dir}
          initial={{ opacity: 0, x: dir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -28 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {tab === 'today' && <Today go={go} />}
          {tab === 'agenda' && <Agenda />}
          {tab === 'cycle' && <Cycle />}
          {tab === 'settings' && <Settings />}
        </motion.div>
      </AnimatePresence>
      <TabBar tab={tab} onChange={go} />
    </>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <main className="app">
          <Shell />
        </main>
      </StoreProvider>
    </MotionConfig>
  );
}
