import { CAT_BY_EN, catKey } from './catalog';
import { PROGRAMS, type Template } from './constants';
import type { Routine, RoutineExercise, SavedEntry, TrainerProgram, Workout } from './types';

/** "Treino de hoje" e sequência de dias: a mesma conta para a Home (H2) e para o Coach. */

export const dayId = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Dias seguidos com treino, contando de hoje (ou de ontem, se hoje ainda não treinou). */
export function dayStreak(workouts: Workout[]) {
  const days = new Set(workouts.map((w) => dayId(new Date(w.date))));
  const d = new Date();
  if (!days.has(dayId(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayId(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Dias da semana atual (segunda a domingo) com a marca de treino feito e de hoje. */
export function weekDays(workouts: Workout[]) {
  const done = new Set(workouts.map((w) => dayId(new Date(w.date))));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const today = dayId(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, done: done.has(dayId(date)), today: dayId(date) === today };
  });
}

/** Minutos estimados: ~2,5 min por série (execução + descanso). */
export const estMin = (sets: number) => Math.max(10, Math.round((sets * 2.5) / 5) * 5);

export const fromTemplate = (t: Template): Routine => ({
  id: '', title: t.title, notes: t.notes,
  exercises: t.exercises.flatMap((n) => CAT_BY_EN.get(n) ?? []).map((c): RoutineExercise => ({
    exerciseId: catKey(c), notes: '', restSec: c.k === 'duration' ? 0 : 90,
    sets: [1, 2, 3].map(() => ({ type: 'normal' as const, kg: null, reps: c.k === 'duration' ? 30 : 10 })),
  })),
});

export type TodayPlan = {
  src: 'trainer' | 'routine' | 'template';
  title: string;
  /** O treino inteiro como entradas (peso vazio = o app preenche com o da última vez ao iniciar). */
  entries: SavedEntry[];
  minutes: number;
  trainerUid?: string;
  routine?: Routine;
};

/** Treino de hoje: próximo do Trainer > primeira rotina > modelo Full Body. */
export function todayPlan(trainer: TrainerProgram | null, routines: Routine[]): TodayPlan {
  const tw = trainer && (trainer.workouts.find((w) => w.uid === trainer.nextUid) ?? trainer.workouts[0]);
  if (trainer && tw)
    return {
      src: 'trainer', title: tw.title, minutes: trainer.settings.duration, trainerUid: tw.uid,
      entries: tw.exercises.map((e) => ({ exerciseId: e.exerciseId, notes: '', restSec: e.restSec, superset: null, sets: Array.from({ length: e.sets }, () => ({ type: 'normal' as const, kg: null, reps: e.repMax })) })),
    };
  const r = routines[0];
  if (r) return { src: 'routine', title: r.title, routine: r, minutes: estMin(r.exercises.reduce((a, e) => a + e.sets.length, 0)), entries: r.exercises.map((e) => ({ ...e, superset: e.superset ?? null })) };
  const t = { ...fromTemplate(PROGRAMS.find((p) => p.id === 'fullbody')!.routines[0]), title: 'Full Body' };
  return { src: 'template', title: t.title, routine: t, minutes: estMin(t.exercises.length * 3), entries: t.exercises.map((e) => ({ ...e, superset: null })) };
}
