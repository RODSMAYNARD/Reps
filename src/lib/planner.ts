import { Exercise, RoutineExercise } from './types';

export type Goal = 'hypertrophy' | 'strength' | 'fatloss';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Gear = 'gym' | 'dumbbell' | 'body';
export type PlanOpts = { goal: Goal; days: number; level: Level; gear: Gear; seed: number };
export type PlannedRoutine = { title: string; notes: string; exercises: RoutineExercise[] };

type Kind = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';
const SLOTS: Record<Kind, [string, number][]> = {
  push: [['Peito', 2], ['Ombros', 2], ['Tríceps', 1]],
  pull: [['Costas', 3], ['Bíceps', 2]],
  legs: [['Quadríceps', 2], ['Posterior', 1], ['Glúteos', 1], ['Panturrilha', 1]],
  upper: [['Peito', 1], ['Costas', 2], ['Ombros', 1], ['Bíceps', 1], ['Tríceps', 1]],
  lower: [['Quadríceps', 2], ['Posterior', 1], ['Glúteos', 1], ['Panturrilha', 1]],
  full: [['Quadríceps', 1], ['Peito', 1], ['Costas', 1], ['Ombros', 1], ['Abdômen', 1]],
};
const LABEL: Record<Kind, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower', full: 'Full Body' };

export const splitFor = (days: number): Kind[] => {
  if (days <= 2) return ['full', 'full'];
  if (days === 3) return ['full', 'full', 'full'];
  if (days === 4) return ['upper', 'lower', 'upper', 'lower'];
  if (days === 5) return ['push', 'pull', 'legs', 'upper', 'lower'];
  return ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
};

const PARAMS: Record<Goal, { sets: number; reps: number; rest: number; label: string }> = {
  hypertrophy: { sets: 3, reps: 10, rest: 90, label: 'Hipertrofia' },
  strength: { sets: 5, reps: 5, rest: 180, label: 'Força' },
  fatloss: { sets: 3, reps: 15, rest: 45, label: 'Emagrecimento' },
};
const PER_LEVEL: Record<Level, number> = { beginner: 4, intermediate: 5, advanced: 6 };

const rng = (seed: number) => { let s = seed || 1; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); };

export function generatePlan(o: PlanOpts, exercises: Exercise[]): { name: string; routines: PlannedRoutine[] } {
  const rand = rng(o.seed);
  const p = PARAMS[o.goal];
  const allowed = (e: Exercise) => o.gear === 'gym' ? true : o.gear === 'dumbbell' ? ['Halter', 'Peso do corpo', 'Elástico', 'Kettlebell'].includes(e.equipment) : e.equipment === 'Peso do corpo';
  const pool = (muscle: string) => {
    const strict = exercises.filter((e) => e.muscle === muscle && allowed(e) && e.kind !== 'duration');
    return strict.length ? strict : exercises.filter((e) => e.muscle === muscle && e.kind !== 'duration');
  };
  const shuffle = <T,>(a: T[]) => a.map((x) => [rand(), x] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const kinds = splitFor(o.days);
  const seen: Record<string, number> = {};
  const routines = kinds.map((k) => {
    seen[k] = (seen[k] ?? 0) + 1;
    const letter = kinds.filter((x) => x === k).length > 1 ? ` ${seen[k] === 1 ? 'A' : seen[k] === 2 ? 'B' : 'C'}` : '';
    const used = new Set<string>();
    const chosen: Exercise[] = [];
    for (const [muscle, n] of SLOTS[k]) {
      const cands = shuffle(pool(muscle));
      cands.slice(0, n).forEach((e) => { if (!used.has(e.id)) { used.add(e.id); chosen.push(e); } });
    }
    const list = chosen.slice(0, PER_LEVEL[o.level] + (k === 'full' ? 0 : 1));
    const exs: RoutineExercise[] = list.map((e) => ({
      exerciseId: e.id, notes: '', restSec: e.kind === 'reps' ? Math.min(60, p.rest) : p.rest,
      sets: Array.from({ length: p.sets }, () => ({ type: 'normal' as const, kg: null, reps: e.kind === 'reps' ? Math.max(8, p.reps) : p.reps })),
    }));
    return { title: `${LABEL[k]}${letter}`, notes: `${p.label} · ${p.sets}×${p.reps} · descanso de ${p.rest}s`, exercises: exs };
  });
  return { name: `${p.label} ${o.days}x/semana`, routines };
}
