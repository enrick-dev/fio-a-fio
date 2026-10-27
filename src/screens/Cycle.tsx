import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { CycleEditor } from '../components/CycleEditor';
import { PositionPicker } from '../components/PositionPicker';
import { Rise, Sheet, Toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { parts, MONTHS } from '../lib/format';
import type { Slot } from '@shared/schedule.ts';

export function Cycle() {
  const { schedule, today, saveCycle } = useStore();
  const current = schedule.versionAt(today);
  const [daDays, setDaDays] = useState(current?.daDays ?? 2);
  const [slots, setSlots] = useState<Slot[]>(current?.slots ?? []);
  const [ask, setAsk] = useState(false);
  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (current) { setDaDays(current.daDays); setSlots(current.slots); }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !current || current.daDays !== daDays || JSON.stringify(current.slots) !== JSON.stringify(slots);
  const tp = parts(today);

  const openAsk = () => {
    // Sugere a posição equivalente à de hoje no ciclo atual, se o formato não mudou muito.
    const info = schedule.day(today);
    setPos(info && info.pos >= 0 ? Math.min(info.pos, (daDays + 1) * slots.length - 1) : 0);
    setAsk(true);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await saveCycle(daDays, slots, pos);
      setAsk(false);
      setToast('Novo ciclo ativo de hoje em diante');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="screen">
        <Rise as="header">
          <p className="eyebrow">Monte sua rotina</p>
          <h1 className="h1">Configurar ciclo</h1>
        </Rise>
        <CycleEditor daDays={daDays} slots={slots} onDaDays={setDaDays} onSlots={setSlots} />
        <section className="card" style={{ padding: '4px 16px' }}>
          <div className="list-row">
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15, fontWeight: 500 }}>
              Vale a partir de<span className="sub">Dias passados ficam como estão</span>
            </span>
            <span className="chip" style={{ background: 'var(--primary-soft)', color: '#9C2E57', fontSize: 14, padding: '8px 12px' }}>
              Hoje, {tp.d} {MONTHS[tp.m].slice(0, 3)}
            </span>
          </div>
        </section>
      </div>
      <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
        <button className="btn block" disabled={!dirty || slots.length === 0} onClick={openAsk}>
          <Icon name="calendar" size={20} stroke={2.2} />
          {dirty ? 'Salvar e atualizar agenda' : 'Nenhuma alteração'}
        </button>
      </div>

      <Sheet open={ask} onClose={() => setAsk(false)} title="Em que dia do ciclo você está hoje?">
        <p className="sub" style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>O novo ciclo começa a contar daqui. Toque no quadrinho que representa hoje.</p>
        <PositionPicker daDays={daDays} slots={slots} value={pos} onChange={setPos} />
        <button className="btn block" disabled={busy} onClick={confirm}>{busy ? 'Salvando…' : 'Aplicar de hoje em diante'}</button>
        <button className="btn ghost" onClick={() => setAsk(false)}>Voltar</button>
      </Sheet>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
