import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schedule, addDays, type CycleVersion, type Slot } from '../supabase/functions/_shared/schedule.ts';

const slots: Slot[] = [
  { type: 'lav', detox: false },
  { type: 'h', detox: false },
  { type: 'lav', detox: false },
  { type: 'n', detox: false },
  { type: 'lav', detox: false },
  { type: 'r', detox: true },
];
const v1: CycleVersion = { id: 'v1', daDays: 2, slots, anchorDate: '2026-10-16', anchorPos: 0 };

const tags = (s: Schedule, from: string, n: number) =>
  s.range(from, n).map((d) => (d.type === 'da' ? 'da' : d.type) + (d.detox ? '+d' : '')).join(' ');

test('ciclo de exemplo tem 18 dias e repete', () => {
  const s = new Schedule([v1], []);
  assert.equal(tags(s, '2026-10-16', 18), 'da da lav da da h da da lav da da n da da lav da da r+d');
  assert.equal(s.day('2026-10-27')!.type, 'n'); // dia 12
  assert.equal(s.day('2026-10-27')!.pos, 11);
  assert.equal(s.day('2026-11-03')!.cycleNumber, 2);
  assert.equal(s.day('2026-10-15'), null);
});

test('remarcar empurra tudo daquela data em diante', () => {
  const s = new Schedule([v1], [{ fromDate: '2026-10-27', days: 2 }]);
  assert.equal(tags(s, '2026-10-26', 6), 'da wait wait n da da');
  assert.equal(s.day('2026-10-26')!.type, 'da'); // antes não muda
});

test('remarcar dia passado com qualquer data', () => {
  const s = new Schedule([v1], [{ fromDate: '2026-10-21', days: 5 }]); // h de 21 feita em 26
  assert.equal(s.day('2026-10-21')!.type, 'wait');
  assert.equal(s.day('2026-10-26')!.type, 'h');
  assert.equal(s.day('2026-10-27')!.type, 'da');
});

test('nova configuração vale de hoje em diante com a posição escolhida', () => {
  const v2: CycleVersion = { id: 'v2', daDays: 1, slots: [{ type: 'h', detox: false }, { type: 'n', detox: false }], anchorDate: '2026-10-27', anchorPos: 1 };
  const s = new Schedule([v1, v2], [{ fromDate: '2026-10-20', days: 1 }]);
  assert.equal(s.day('2026-10-26')!.versionId, 'v1');
  assert.equal(tags(s, '2026-10-27', 5), 'h da n da h');
  // remarcação anterior à nova versão não afeta a nova
  assert.equal(s.day(addDays('2026-10-27', 0))!.pos, 1);
});

test('day after zero', () => {
  const s = new Schedule([{ daDays: 0, slots: [{ type: 'h', detox: false }, { type: 'r', detox: true }], anchorDate: '2026-01-01', anchorPos: 0 }], []);
  assert.equal(tags(s, '2026-01-01', 3), 'h r+d h');
});
