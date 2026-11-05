import { MUSCLE_GROUPS } from './constants';
import { Exercise, SetRow, Workout } from './types';

export const setVolume = (s: SetRow) => (s.type === 'warmup' ? 0 : (s.kg ?? 0) * (s.reps ?? 0));
export const workoutVolume = (w: Workout) => w.entries.reduce((t, e) => t + e.sets.reduce((a, s) => a + setVolume(s), 0), 0);
export const workoutSets = (w: Workout) => w.entries.reduce((t, e) => t + e.sets.length, 0);
export const oneRM = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export function records(workouts: Workout[], exerciseId: string) {
  let heaviest = 0, best1rm = 0, bestSet: SetRow | null = null, bestSession = 0;
  for (const w of workouts) {
    const e = w.entries.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    let session = 0;
    for (const s of e.sets) {
      if (s.type === 'warmup') continue;
      const kg = s.kg ?? 0, reps = s.reps ?? 0;
      heaviest = Math.max(heaviest, kg);
      best1rm = Math.max(best1rm, oneRM(kg, reps));
      if (!bestSet || kg * reps > (bestSet.kg ?? 0) * (bestSet.reps ?? 0)) bestSet = s;
      session += kg * reps;
    }
    bestSession = Math.max(bestSession, session);
  }
  return { heaviest, best1rm, bestSet, bestSession };
}

export function exerciseSeries(workouts: Workout[], exerciseId: string, metric: 'heaviest' | 'orm' | 'setVolume' | 'sessionVolume' | 'reps') {
  return workouts
    .slice()
    .reverse()
    .flatMap((w) => {
      const e = w.entries.find((x) => x.exerciseId === exerciseId);
      if (!e) return [];
      const work = e.sets.filter((s) => s.type !== 'warmup');
      if (!work.length) return [];
      const v =
        metric === 'heaviest' ? Math.max(...work.map((s) => s.kg ?? 0))
        : metric === 'orm' ? Math.max(...work.map((s) => oneRM(s.kg ?? 0, s.reps ?? 0)))
        : metric === 'setVolume' ? Math.max(...work.map((s) => (s.kg ?? 0) * (s.reps ?? 0)))
        : metric === 'reps' ? Math.max(...work.map((s) => s.reps ?? 0))
        : work.reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0);
      return [{ date: w.date, value: v }];
    });
}

export const startOfWeek = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
export const dayKey = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function weeklySeries(workouts: Workout[], metric: 'duration' | 'volume' | 'reps', weeks = 12) {
  const start = startOfWeek();
  return Array.from({ length: weeks }, (_, i) => {
    const from = new Date(start);
    from.setDate(from.getDate() - 7 * (weeks - 1 - i));
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    const inWeek = workouts.filter((w) => new Date(w.date) >= from && new Date(w.date) < to);
    const value = inWeek.reduce(
      (t, w) => t + (metric === 'duration' ? w.durationSec / 3600 : metric === 'volume' ? workoutVolume(w) : w.entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.reps ?? 0), 0), 0)),
      0,
    );
    return { label: from.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value };
  });
}

export function weekStreak(workouts: Workout[]) {
  const weeks = new Set(workouts.map((w) => dayKey(startOfWeek(new Date(w.date)))));
  let n = 0;
  const d = startOfWeek();
  if (!weeks.has(dayKey(d))) d.setDate(d.getDate() - 7);
  while (weeks.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 7);
  }
  return n;
}

export function muscleDistribution(workouts: Workout[], exercises: Exercise[], sinceDays?: number) {
  const from = sinceDays ? Date.now() - sinceDays * 86400000 : 0;
  const map = new Map<string, number>();
  for (const w of workouts) {
    if (new Date(w.date).getTime() < from) continue;
    for (const e of w.entries) {
      const ex = exercises.find((x) => x.id === e.exerciseId);
      if (!ex) continue;
      const g = MUSCLE_GROUPS[ex.muscle] ?? ex.muscle;
      map.set(g, (map.get(g) ?? 0) + e.sets.length);
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map].map(([name, sets]) => ({ name, sets, pct: Math.round((sets / total) * 100) })).sort((a, b) => b.sets - a.sets);
}
