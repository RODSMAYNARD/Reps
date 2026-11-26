import type { SavedEntry, SetRow, Workout } from './types';

/** Dados de exemplo (Settings > Sample data, 2026-11-23): 90 dias de treinos variados, gerados no aparelho.
 * Nunca vão ao Supabase nem à cópia offline: o store só junta à lista que as telas leem quando a opção está ligada.
 * Ids começam com `sample-` (não dá para editar nem apagar). Mesma semente = mesmos treinos toda vez. */
export const SAMPLE_PREFIX = 'sample-';
export const isSample = (id: string) => id.startsWith(SAMPLE_PREFIX);

type Ex = { id: string; kg: number | null; reps: number; step: number };
// exercícios do catálogo (id `cat:`), peso inicial em kg (null = só reps), reps alvo e aumento por semana
const E = (id: string, kg: number | null, reps: number, step = 2.5): Ex => ({ id: `cat:${id}`, kg, reps, step });
const DAYS: { title: string; ex: Ex[] }[] = [
  { title: 'Push', ex: [E('0025', 60, 8), E('0314', 22, 10, 1), E('0188', 15, 12, 1), E('0334', 8, 15, 0.5), E('0201', 25, 12, 1.25)] },
  { title: 'Pull', ex: [E('0027', 55, 8), E('0198', 50, 10, 2.5), E('0861', 45, 12, 2.5), E('0031', 25, 10, 1.25), E('0313', 12, 12, 0.5)] },
  { title: 'Legs', ex: [E('0043', 80, 6, 2.5), E('1459', 20, 10, 1), E('0585', 40, 12, 2.5), E('0586', 35, 12, 1.25), E('0594', 40, 15, 2.5)] },
  { title: 'Upper Body', ex: [E('0025', 57.5, 10), E('0027', 52.5, 10), E('0334', 8, 15, 0.5), E('0294', 12, 12, 0.5), E('0662', null, 20)] },
  { title: 'Lower Body', ex: [E('0032', 100, 5, 2.5), E('0336', 16, 10, 1), E('0585', 40, 12, 2.5), E('0594', 40, 15, 2.5), E('0274', null, 20)] },
  { title: 'Full Body', ex: [E('0043', 70, 8), E('0025', 55, 10), E('0652', null, 8), E('0334', 7, 15, 0.5), E('0274', null, 25)] },
];
// semana típica: seg Push, ter Pull, qua folga, qui Legs, sex Upper, sáb Lower ou Full Body, dom folga
const PLAN = [0, 1, -1, 2, 3, 4, -1];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const round = (kg: number, step: number) => Math.max(step, Math.round(kg / step) * step);

export function makeSampleWorkouts(days = 90, now = new Date()): Workout[] {
  const r = rng(90);
  const out: Workout[] = [];
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    if (day > now) break;
    let slot = PLAN[(day.getDay() + 6) % 7];
    if (slot === 4 && r() < 0.4) slot = 5; // sábado às vezes vira corpo todo
    if (slot < 0 || r() < 0.15) continue; // folga, e ~15% de dias pulados
    const week = Math.floor(i / 7);
    const deload = week > 0 && week % 6 === 5; // uma semana mais leve a cada 6
    const tpl = DAYS[slot];
    const entries: SavedEntry[] = tpl.ex.map((ex, k) => {
      const sets: SetRow[] = [];
      const base = ex.kg == null ? null : round(ex.kg + ex.step * week * (deload ? 0.5 : 1) * (0.8 + r() * 0.4), ex.step >= 2.5 ? 2.5 : ex.step);
      if (k === 0 && base != null) sets.push({ type: 'warmup', kg: round(base * 0.5, 2.5), reps: 10 });
      const n = deload ? 2 : 3 + (r() < 0.35 ? 1 : 0);
      for (let s = 0; s < n; s++) {
        const reps = Math.max(3, ex.reps + (ex.kg == null ? Math.floor(week / 2) : 0) - s + Math.round(r() * 2 - 1));
        sets.push({ type: !deload && s === n - 1 && r() < 0.2 ? 'failure' : 'normal', kg: base, reps });
      }
      return { exerciseId: ex.id, notes: '', restSec: ex.kg == null ? 60 : k === 0 ? 150 : 90, sets };
    });
    const date = new Date(day); date.setHours(r() < 0.6 ? 7 : 18, Math.floor(r() * 50), 0, 0);
    if (date > now) continue;
    out.push({
      id: `${SAMPLE_PREFIX}${i}`, date: date.toISOString(), title: deload ? `${tpl.title} (light)` : tpl.title, description: '',
      durationSec: (40 + Math.floor(r() * 35)) * 60 + Math.floor(r() * 60), visibility: 'private', entries,
    });
  }
  return out.reverse();
}
