import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useInstall } from '../lib/install';
import { Icon } from './Icon';
import { spring } from '../lib/theme';

const DISMISS_KEY = 'fio-install-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Convite para instalar o app. `compact` = faixa dispensável na Home; senão, cartão completo em Ajustes. */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  const { state, install } = useInstall();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showSteps, setShowSteps] = useState(false);

  if (state === 'installed') {
    if (compact) return null;
    return (
      <div className="card row" style={{ padding: '14px 16px' }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--ok-bg)', color: 'var(--ok-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={18} stroke={2.6} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>App instalado neste aparelho</span>
      </div>
    );
  }
  if (compact && (dismissed || state === 'manual')) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sem armazenamento */ }
  };

  const steps =
    state === 'ios'
      ? ['Toque em Compartilhar (o quadrado com a seta) no Safari', 'Escolha “Adicionar à Tela de Início”', 'Toque em Adicionar']
      : ['No Chrome, abra o menu ⋮ (canto superior direito)', 'Escolha “Instalar app” ou “Adicionar à tela inicial”', 'Confirme em Instalar'];

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring}
        className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderColor: '#F3C2D3', background: '#FFFFFF' }}
      >
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Instale o Fio a Fio</h2>
            <p className="sub" style={{ margin: '2px 0 0', lineHeight: 1.4 }}>
              Abra direto da tela do celular ou da área de trabalho, em janela própria, sem o navegador.
            </p>
          </div>
          {compact && (
            <button aria-label="Dispensar" onClick={dismiss} style={{ width: 36, height: 36, border: 'none', background: 'none', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        {state === 'available' ? (
          <motion.button whileTap={{ scale: 0.96 }} className="btn block" style={{ minHeight: 48 }} onClick={() => install()}>
            Instalar app
          </motion.button>
        ) : (
          <>
            <button className="btn block light" style={{ minHeight: 44, border: '1px solid var(--line)', fontSize: 14 }} onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps}>
              {showSteps ? 'Fechar instruções' : 'Como instalar'}
            </button>
            <AnimatePresence initial={false}>
              {showSteps && (
                <motion.ol
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, overflow: 'hidden' }}
                >
                  {steps.map((s) => <li key={s}>{s}</li>)}
                </motion.ol>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.section>
    </AnimatePresence>
  );
}
