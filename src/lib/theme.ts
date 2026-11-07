export type Scheme = 'light' | 'dark';

const light = {
  bg: '#FFFFFF',
  surface: '#F2F4F7',
  surfaceAlt: '#EAEEF3',
  border: '#E3E7ED',
  text: '#0B1220',
  muted: '#6B7280',
  faint: '#A3AAB5',
  primary: '#0A84FF',
  primarySoft: '#E6F2FF',
  onPrimary: '#FFFFFF',
  danger: '#E5484D',
  dangerSoft: '#FDEDED',
  success: '#34C759',
  successSoft: '#CFF5D8',
  warn: '#F5A524',
  warnSoft: '#FFF4BF',
  purple: '#9B51E0',
  black: '#0B0B0F',
  overlay: 'rgba(0,0,0,0.45)',
  bodyBase: '#B9C0CB',
  bodyMuscle: '#E3E7ED',
  dot: '#D5DAE1',
};

const dark: typeof light = {
  bg: '#0B0F17',
  surface: '#161B26',
  surfaceAlt: '#1F2633',
  border: '#262E3D',
  text: '#F2F4F8',
  muted: '#9AA3B2',
  faint: '#6B7586',
  primary: '#2D8CFF',
  primarySoft: '#13294A',
  onPrimary: '#FFFFFF',
  danger: '#F2555A',
  dangerSoft: '#3A1B1F',
  success: '#34C759',
  successSoft: '#17361F',
  warn: '#F5A524',
  warnSoft: '#3A2E0F',
  purple: '#A768EA',
  black: '#2A3242',
  overlay: 'rgba(0,0,0,0.65)',
  bodyBase: '#5A6475',
  bodyMuscle: '#2A3242',
  dot: '#3A4356',
};

/** Paleta ativa. É um objeto único e mutável: `applyScheme` troca os valores no lugar e a raiz do app remonta as telas,
 * então todo `colors.x` lido na renderização já vem na paleta certa. */
export const colors: typeof light = { ...light };
let current: Scheme = 'light';
export function applyScheme(s: Scheme) {
  if (s === current) return;
  current = s;
  Object.assign(colors, s === 'dark' ? dark : light);
}
export const currentScheme = () => current;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
