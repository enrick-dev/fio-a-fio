import { parseDate } from '@shared/schedule.ts';

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function parts(date: string) {
  const dt = new Date(parseDate(date) * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), wd: dt.getUTCDay() };
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Terça, 27 de outubro" */
export function longDate(date: string) {
  const p = parts(date);
  return `${WEEKDAYS[p.wd]}, ${p.d} de ${MONTHS[p.m]}`;
}

/** "Ter, 27/10" */
export function shortDate(date: string) {
  const p = parts(date);
  return `${WD_SHORT[p.wd]}, ${p.d}/${p.m + 1}`;
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
