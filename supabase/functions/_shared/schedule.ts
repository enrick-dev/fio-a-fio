// Motor do cronograma capilar.
// Este arquivo é usado tanto pelo app (Vite) quanto pelas Edge Functions (Deno),
// por isso não importa nada de fora.

export type WashType = 'lav' | 'h' | 'n' | 'r';
export type DayType = 'da' | WashType | 'wait';

export interface Slot {
  type: WashType;
  detox: boolean;
}

/** Uma versão da configuração do ciclo. Vale a partir de `anchorDate`, quando o dia era `anchorPos`. */
export interface CycleVersion {
  id?: string;
  daDays: number;
  slots: Slot[];
  anchorDate: string; // YYYY-MM-DD
  anchorPos: number; // índice 0-based dentro do ciclo
  createdAt?: string;
}

/** Remarcação: o dia `fromDate` não foi feito; ele foi (ou será) feito `days` dias depois. */
export interface Shift {
  id?: string;
  fromDate: string; // YYYY-MM-DD
  days: number;
  createdAt?: string;
}

export interface CyclePosition {
  type: 'da' | WashType;
  detox: boolean;
  daIndex: number; // 1..daDays para day after, 0 para lavagem
  slotIndex: number; // a qual lavagem este dia pertence
}

export interface DayInfo {
  date: string;
  type: DayType;
  detox: boolean;
  daIndex: number;
  daTotal: number;
  pos: number; // -1 em dias de espera
  cycleLength: number;
  cycleNumber: number; // 1, 2, 3... desde a âncora da versão
  versionId?: string;
}

export const TYPE_META: Record<DayType, { tag: string; name: string; short: string }> = {
  da: { tag: 'DA', name: 'Day after', short: 'Day after' },
  lav: { tag: 'S/C', name: 'Shampoo + condicionador', short: 'Lavagem' },
  h: { tag: 'H', name: 'Shampoo + hidratação', short: 'Hidratação' },
  n: { tag: 'N', name: 'Shampoo + nutrição', short: 'Nutrição' },
  r: { tag: 'R', name: 'Shampoo + reconstrução', short: 'Reconstrução' },
  wait: { tag: '+DA', name: 'Day after extra', short: 'Remarcado' },
};

// ---------- datas (sempre strings YYYY-MM-DD, sem fuso) ----------

export function parseDate(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function formatDate(dayNumber: number): string {
  const dt = new Date(dayNumber * 86400000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, n: number): string {
  return formatDate(parseDate(date) + n);
}

export function diffDays(a: string, b: string): number {
  return parseDate(b) - parseDate(a);
}

export function weekday(date: string): number {
  return new Date(parseDate(date) * 86400000).getUTCDay();
}

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------- ciclo ----------

export function buildPositions(daDays: number, slots: Slot[]): CyclePosition[] {
  const out: CyclePosition[] = [];
  slots.forEach((slot, slotIndex) => {
    for (let i = 1; i <= daDays; i++) {
      out.push({ type: 'da', detox: false, daIndex: i, slotIndex });
    }
    out.push({ type: slot.type, detox: slot.detox, daIndex: 0, slotIndex });
  });
  return out;
}

function mod(a: number, n: number) {
  return ((a % n) + n) % n;
}

function sortVersions(versions: CycleVersion[]) {
  return [...versions].sort((a, b) =>
    a.anchorDate === b.anchorDate
      ? (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      : a.anchorDate.localeCompare(b.anchorDate),
  );
}

function sortShifts(shifts: Shift[]) {
  return [...shifts].sort((a, b) =>
    a.fromDate === b.fromDate
      ? (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      : a.fromDate.localeCompare(b.fromDate),
  );
}

export class Schedule {
  private versions: CycleVersion[];
  private shifts: Shift[];
  private posCache = new Map<CycleVersion, CyclePosition[]>();

  constructor(versions: CycleVersion[], shifts: Shift[]) {
    this.versions = sortVersions(versions.filter((v) => v.slots.length > 0));
    this.shifts = sortShifts(shifts.filter((s) => s.days > 0));
  }

  get hasConfig() {
    return this.versions.length > 0;
  }

  versionAt(date: string): CycleVersion | null {
    let found: CycleVersion | null = null;
    for (const v of this.versions) {
      if (v.anchorDate <= date) found = v;
      else break;
    }
    return found;
  }

  positions(v: CycleVersion): CyclePosition[] {
    let p = this.posCache.get(v);
    if (!p) {
      p = buildPositions(v.daDays, v.slots);
      this.posCache.set(v, p);
    }
    return p;
  }

  /** Informação de um dia. `null` se for antes da primeira configuração. */
  day(date: string): DayInfo | null {
    const v = this.versionAt(date);
    if (!v) return null;
    const positions = this.positions(v);
    const len = positions.length;
    let offset = diffDays(v.anchorDate, date);

    // Remarcações feitas a partir da âncora desta versão empurram o ciclo.
    for (const s of this.shifts) {
      if (s.fromDate < v.anchorDate) continue;
      if (s.fromDate > date) break;
      const into = diffDays(s.fromDate, date);
      if (into < s.days) {
        return {
          date, type: 'wait', detox: false, daIndex: 0, daTotal: v.daDays,
          pos: -1, cycleLength: len, cycleNumber: 0, versionId: v.id,
        };
      }
      offset -= s.days;
    }

    const absolute = v.anchorPos + offset;
    const pos = mod(absolute, len);
    const p = positions[pos];
    return {
      date,
      type: p.type,
      detox: p.detox,
      daIndex: p.daIndex,
      daTotal: v.daDays,
      pos,
      cycleLength: len,
      cycleNumber: Math.floor(absolute / len) + 1,
      versionId: v.id,
    };
  }

  range(from: string, days: number): DayInfo[] {
    const out: DayInfo[] = [];
    for (let i = 0; i < days; i++) {
      const d = this.day(addDays(from, i));
      if (d) out.push(d);
    }
    return out;
  }

  /** Próxima lavagem a partir de `date` (exclusive). */
  nextWash(date: string, maxDays = 120): DayInfo | null {
    for (let i = 1; i <= maxDays; i++) {
      const d = this.day(addDays(date, i));
      if (d && d.type !== 'da' && d.type !== 'wait') return d;
    }
    return null;
  }
}

export function isWash(t: DayType): t is WashType {
  return t === 'lav' || t === 'h' || t === 'n' || t === 'r';
}

export interface Products {
  lav?: string;
  h?: string;
  n?: string;
  r?: string;
  detox?: string;
}

export function dayTitle(d: Pick<DayInfo, 'type' | 'detox' | 'daIndex' | 'daTotal'>): string {
  if (d.type === 'da') return `Day after ${d.daIndex} de ${d.daTotal}`;
  if (d.type === 'wait') return 'Day after extra';
  return TYPE_META[d.type].name + (d.detox ? ' + detox' : '');
}

export interface Step {
  id: string;
  label: string;
  sub: string;
}

export function daySteps(d: Pick<DayInfo, 'type' | 'detox'>, products: Products = {}): Step[] {
  const p = (name?: string) => (name ? ` · ${name}` : '');
  switch (d.type) {
    case 'da':
      return [
        { id: 'react', label: 'Sem lavar', sub: 'Reative só se precisar' },
        { id: 'sleep', label: 'Touca de cetim', sub: 'Protege a fibra durante a noite' },
      ];
    case 'wait':
      return [{ id: 'wait', label: 'Day after extra', sub: 'A lavagem foi remarcada e o cronograma andou junto' }];
    case 'lav':
      return [
        { id: 'shampoo', label: 'Shampoo', sub: 'Massageando o couro cabeludo' + p(products.lav) },
        { id: 'cond', label: 'Condicionador', sub: 'Só no comprimento' },
        { id: 'rinse', label: 'Enxágue frio', sub: 'Para selar as cutículas' },
      ];
    default: {
      const steps: Step[] = [{ id: 'shampoo', label: 'Shampoo', sub: 'Duas aplicações' + p(products.lav) }];
      if (d.detox) steps.push({ id: 'detox', label: 'Detox quelante', sub: 'Remove resíduos e minerais' + p(products.detox) });
      const mask = { h: 'hidratação', n: 'nutrição', r: 'reconstrução' }[d.type];
      const time = d.type === 'r' ? '10 min' : '15 min';
      steps.push({ id: 'mask', label: `Máscara de ${mask}`, sub: `Do comprimento às pontas · ${time}` + p(products[d.type]) });
      steps.push({ id: 'rinse', label: 'Enxágue frio', sub: 'Para selar as cutículas' });
      return steps;
    }
  }
}
