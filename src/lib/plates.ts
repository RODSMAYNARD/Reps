import type { Units } from './types';

export type WUnit = Units['weight'];
/** Anilhas de um sistema de unidade: `all` = as que existem na lista, `on` = as ligadas, `bar` = id da barra escolhida. */
export type PlateSet = { all: number[]; on: number[]; bar: string };

export const BARS: Record<WUnit, { id: string; label: string; w: number }[]> = {
  kg: [{ id: 'standard', label: 'Standard', w: 20 }, { id: 'short', label: 'Short', w: 15 }, { id: 'ez', label: 'EZ bar', w: 7.5 }, { id: 'none', label: 'No bar', w: 0 }],
  lbs: [{ id: 'standard', label: 'Standard', w: 45 }, { id: 'short', label: 'Short', w: 35 }, { id: 'ez', label: 'EZ bar', w: 15 }, { id: 'none', label: 'No bar', w: 0 }],
};

export const DEFAULT_PLATES: Record<WUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  lbs: [45, 35, 25, 10, 5, 2.5, 1.25],
};

export const DEFAULT_PLATE_SETS: Record<WUnit, PlateSet> = {
  kg: { all: DEFAULT_PLATES.kg, on: DEFAULT_PLATES.kg, bar: 'standard' },
  lbs: { all: DEFAULT_PLATES.lbs, on: DEFAULT_PLATES.lbs, bar: 'standard' },
};

export const unitLabel = (u: WUnit) => (u === 'kg' ? 'kg' : 'lbs');
export const barOf = (unit: WUnit, id: string) => BARS[unit].find((b) => b.id === id) ?? BARS[unit][0];
export const fmtPlate = (n: number) => String(Math.round(n * 100) / 100);

export type PlateSolution = {
  /** Anilhas de um lado, da maior (junto da trava) para a menor. */
  perSide: number[];
  /** Peso total montado: barra + as duas laterais. */
  total: number;
  /** O alvo foi montado exatamente. */
  exact: boolean;
};

const SCALE = 100; // centésimos: soma inteira, sem erro de ponto flutuante (1,25 + 0,5 ...)
const MAX_SIDE = 100000; // 1.000 kg por lado: limite só para a tabela não crescer sem fim

/** Monta o alvo com as anilhas ligadas, número ilimitado de cada uma (como no Hevy: várias de 0,5 se precisar).
 * Escolhe o peso montável MAIS PRÓXIMO do alvo (empate: o mais leve) e, entre os de mesma distância, o de menos anilhas.
 * Troco mínimo por programação dinâmica, e não "guloso": o guloso erra com anilhas personalizadas (ex.: 6 + 4 + 1). */
export function solvePlates(target: number, bar: number, plates: number[]): PlateSolution {
  const coins = [...new Set(plates.map((p) => Math.round(p * SCALE)).filter((p) => p > 0))].sort((a, b) => b - a);
  const want = Math.min(MAX_SIDE, Math.max(0, Math.round(((target - bar) / 2) * SCALE)));
  if (!coins.length || target <= bar) return { perSide: [], total: bar, exact: Math.abs(target - bar) < 0.005 };
  const limit = want + coins[0];
  const count = new Int32Array(limit + 1).fill(-1);
  const via = new Int32Array(limit + 1);
  count[0] = 0;
  for (let i = 1; i <= limit; i++) {
    for (const c of coins) {
      if (c > i || count[i - c] < 0) continue;
      const n = count[i - c] + 1;
      if (count[i] < 0 || n < count[i]) { count[i] = n; via[i] = c; }
    }
  }
  let pick = 0, dist = want;
  for (let i = 1; i <= limit; i++) {
    if (count[i] < 0) continue;
    const d = Math.abs(i - want);
    if (d < dist) { pick = i; dist = d; }
  }
  const perSide: number[] = [];
  for (let i = pick; i > 0; i -= via[i]) perSide.push(via[i] / SCALE);
  perSide.sort((a, b) => b - a);
  const total = Math.round((bar + (2 * pick) / SCALE) * SCALE) / SCALE;
  return { perSide, total, exact: Math.abs(total - target) < 0.005 };
}
