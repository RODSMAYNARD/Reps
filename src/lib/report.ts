import { MUSCLE_GROUPS } from './constants';
import { workoutSets, workoutVolume } from './stats';
import { Exercise, Workout } from './types';

export type Metric = 'workouts' | 'duration' | 'volume' | 'sets';
export const inMonth = (ws: Workout[], y: number, m: number) => ws.filter((w) => { const d = new Date(w.date); return d.getFullYear() === y && d.getMonth() === m; });
export const metricValue = (ws: Workout[], k: Metric) => (k === 'workouts' ? ws.length : k === 'duration' ? ws.reduce((t, w) => t + w.durationSec, 0) : k === 'volume' ? ws.reduce((t, w) => t + workoutVolume(w), 0) : ws.reduce((t, w) => t + workoutSets(w), 0));

export function tally(ws: Workout[], find: (id: string) => Exercise | undefined) {
  const groups = new Map<string, number>(), muscles = new Map<string, number>(), ex = new Map<string, { name: string; n: number; catalogId?: string | null }>();
  ws.forEach((w) => w.entries.forEach((e) => {
    const x = find(e.exerciseId);
    if (!x) return;
    const g = MUSCLE_GROUPS[x.muscle] ?? x.muscle;
    groups.set(g, (groups.get(g) ?? 0) + e.sets.length);
    muscles.set(x.muscle, (muscles.get(x.muscle) ?? 0) + e.sets.length);
    ex.set(x.id, { name: x.name, catalogId: x.catalogId, n: (ex.get(x.id)?.n ?? 0) + 1 });
  }));
  return { groups, muscles, ex };
}
