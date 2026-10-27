import type { DayType } from '@shared/schedule.ts';

export const TYPE_COLORS: Record<DayType, { bg: string; fg: string; border?: string }> = {
  da: { bg: '#FCE4EC', fg: '#9C2E57' },
  lav: { bg: '#E3F1EF', fg: '#1F6F66' },
  h: { bg: '#E2EEFA', fg: '#1F5E99' },
  n: { bg: '#FDF0DC', fg: '#8A5208' },
  r: { bg: '#EFE3F7', fg: '#6A2F8E' },
  wait: { bg: '#FFFFFF', fg: '#9C2E57', border: '1.5px dashed #E6A9BF' },
};

export const spring = { type: 'spring', stiffness: 420, damping: 32 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 26 } as const;
export const easeOut = [0.2, 0.8, 0.2, 1] as const;
