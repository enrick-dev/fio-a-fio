import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CycleEditor, DEFAULT_SLOTS } from '../components/CycleEditor';
import { PositionPicker } from '../components/PositionPicker';
import { useStore } from '../lib/store';
import type { Slot } from '@shared/schedule.ts';

/** Primeiro acesso: monta o ciclo e diz em que dia está hoje. */
export function Onboarding() {
  const { saveCycle } = useStore();
  const [step, setStep] = useState<0 | 1>(0);
  const [daDays, setDaDays] = useState(2);
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS);
  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveCycle(daDays, slots, pos);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="screen">
        <header>
          <p className="eyebrow">Passo {step + 1} de 2</p>
          <h1 className="h1">{step === 0 ? 'Monte seu ciclo' : 'Em que dia você está hoje?'}</h1>
        </header>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {step === 0 ? (
              <CycleEditor daDays={daDays} slots={slots} onDaDays={setDaDays} onSlots={setSlots} />
            ) : (
              <>
                <p className="sub" style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>Toque no quadrinho que representa hoje. O cronograma começa a contar daqui.</p>
                <PositionPicker daDays={daDays} slots={slots} value={pos} onChange={setPos} />
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
      </div>
      <div style={{ flexShrink: 0, padding: '12px 20px calc(16px + var(--safe-bottom))', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
        {step === 1 && <button className="btn ghost" onClick={() => setStep(0)}>Voltar</button>}
        <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => (step === 0 ? setStep(1) : finish())}>
          {step === 0 ? 'Continuar' : busy ? 'Criando seu cronograma…' : 'Começar cronograma'}
        </button>
      </div>
    </>
  );
}
