import { MUSCLE_GROUPS } from './constants';
import { Exercise, ExerciseKind, SetRow, Workout } from './types';
import { locale } from './i18n';

/** Busca do exercício por id (real ou `cat:<id>`), registrada pelo store. Sem ela, os cálculos tratam tudo como peso × reps. */
let lookupEx: (id: string) => Exercise | undefined = () => undefined;
export const setExerciseLookup = (f: (id: string) => Exercise | undefined) => { lookupEx = f; };
export const exerciseOf = (exerciseId: string) => lookupEx(exerciseId);
/** Tipo do exercício (undefined quando não se sabe: conta como peso × reps). */
export const kindOf = (exerciseId: string) => lookupEx(exerciseId)?.kind;
/** Id único do exercício: o `cat:<id>` de treinos ainda na fila vira o id real quando o exercício já existe no banco. */
export const canonId = (exerciseId: string) => lookupEx(exerciseId)?.id ?? exerciseId;

/** Peso × repetições (weight_reps e weighted_bodyweight; tipo desconhecido conta como tal): só nesses há 1RM, volume e recorde de peso. */
export const isWeightReps = (kind?: ExerciseKind) => !kind || kind === 'weight_reps' || kind === 'weighted_bodyweight';
/** O peso registrado é carga de verdade (no assistido é ajuda; reps, duração e distância não têm peso). */
export const countsLoad = (kind?: ExerciseKind) => isWeightReps(kind) || kind === 'duration_weight' || kind === 'weight_distance';
/** Tem repetições de verdade (no `duration` antigo, `reps` guarda segundos). */
const hasReps = (kind?: ExerciseKind) => isWeightReps(kind) || kind === 'reps' || kind === 'assisted_bodyweight';

/** Volume da série = peso × reps, sem aquecimento e só nos tipos peso × reps (no assistido o peso é ajuda e não conta). */
export const setVolume = (s: SetRow, kind?: ExerciseKind) => (s.type === 'warmup' || !isWeightReps(kind) ? 0 : (s.kg ?? 0) * (s.reps ?? 0));
export const workoutVolume = (w: Workout) => w.entries.reduce((t, e) => { const k = kindOf(e.exerciseId); return t + e.sets.reduce((a, s) => a + setVolume(s, k), 0); }, 0);
export const workoutSets = (w: Workout) => w.entries.reduce((t, e) => t + e.sets.length, 0);
export const oneRM = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** Nota da série para achar a melhor conforme o tipo: [principal, desempate]. */
const setScore = (s: SetRow, kind?: ExerciseKind): [number, number] => {
  const kg = s.kg ?? 0, reps = s.reps ?? 0, sec = s.seconds ?? 0, m = s.distM ?? 0;
  if (kind === 'reps' || kind === 'duration') return [reps, 0]; // no `duration` antigo, reps = segundos
  if (kind === 'assisted_bodyweight') return [reps, -kg]; // empate: menos ajuda
  if (kind === 'duration_weight') return [kg * sec, sec];
  if (kind === 'distance_duration') return [m, sec ? -sec : -Infinity]; // empate: menos tempo (sem tempo fica atrás)
  if (kind === 'weight_distance') return [kg * m, m];
  return [kg * reps, reps];
};
const beats = (a: [number, number], b: [number, number]) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
const filled = (s: SetRow) => (s.kg ?? 0) > 0 || (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0 || (s.distM ?? 0) > 0;

/** Séries do treino em andamento que batem recorde (peso, 1RM estimado ou volume da série), como no Hevy:
 * cada série concluída é comparada ao histórico e às séries concluídas antes dela; as medalhas anteriores continuam.
 * Sem histórico do exercício não há recorde para superar; tipos que não são peso × reps não têm esse recorde. */
export function prFlags(rec: { heaviest: number; best1rm: number; bestSet: SetRow | null }, sets: { type: string; kg: number | null; reps: number | null; done: boolean }[], kind?: ExerciseKind): boolean[] {
  if (!rec.bestSet || !isWeightReps(kind)) return sets.map(() => false);
  let heaviest = rec.heaviest, orm = rec.best1rm, vol = (rec.bestSet.kg ?? 0) * (rec.bestSet.reps ?? 0);
  return sets.map((s) => {
    if (!s.done || s.type === 'warmup') return false;
    const kg = s.kg ?? 0, reps = s.reps ?? 0;
    if (kg <= 0) return false;
    const o = oneRM(kg, reps), v = kg * reps;
    const hit = kg > heaviest || o > orm + 1e-9 || v > vol;
    heaviest = Math.max(heaviest, kg); orm = Math.max(orm, o); vol = Math.max(vol, v);
    return hit;
  });
}

type Records = { heaviest: number; best1rm: number; bestSet: SetRow | null; bestSession: number };
const emptyRecords: Records = { heaviest: 0, best1rm: 0, bestSet: null, bestSession: 0 };

export function records(workouts: Workout[], exerciseId: string) {
  return recordsMap(workouts).get(canonId(exerciseId)) ?? emptyRecords;
}

/** Mesmo cálculo de `records`, mas para todos os exercícios de uma vez (uma só passada pelos treinos).
 * Usar em listas (ex.: biblioteca de exercícios) em vez de chamar `records` por linha — evita refazer
 * o histórico inteiro a cada exercício renderizado. Chave = id canônico (`canonId`).
 * Maior peso só conta carga de verdade (`countsLoad`), 1RM e volume só peso × reps; a melhor série segue o tipo (`setScore`);
 * a sessão soma todas as entradas do exercício no treino (ele pode aparecer 2x). */
export function recordsMap(workouts: Workout[]) {
  const map = new Map<string, Records>(), score = new Map<string, [number, number]>();
  for (const w of workouts) {
    const session = new Map<string, number>();
    for (const e of w.entries) {
      const id = canonId(e.exerciseId), kind = kindOf(e.exerciseId);
      const r: Records = map.get(id) ?? { heaviest: 0, best1rm: 0, bestSet: null, bestSession: 0 };
      let vol = 0;
      for (const s of e.sets) {
        if (s.type === 'warmup') continue;
        const kg = s.kg ?? 0, reps = s.reps ?? 0;
        if (countsLoad(kind)) r.heaviest = Math.max(r.heaviest, kg);
        if (isWeightReps(kind)) r.best1rm = Math.max(r.best1rm, oneRM(kg, reps));
        if (filled(s)) { const sc = setScore(s, kind), top = score.get(id); if (!top || beats(sc, top)) { r.bestSet = s; score.set(id, sc); } }
        vol += setVolume(s, kind);
      }
      session.set(id, (session.get(id) ?? 0) + vol);
      map.set(id, r);
    }
    session.forEach((v, id) => { const r = map.get(id)!; r.bestSession = Math.max(r.bestSession, v); });
  }
  return map;
}

export function exerciseSeries(workouts: Workout[], exerciseId: string, metric: 'heaviest' | 'orm' | 'setVolume' | 'sessionVolume' | 'reps') {
  const id = canonId(exerciseId), kind = kindOf(exerciseId);
  return workouts
    .slice()
    .reverse()
    .flatMap((w) => {
      // o mesmo exercício pode aparecer 2x no treino: junta as séries de todas as entradas
      const work = w.entries.filter((x) => canonId(x.exerciseId) === id).flatMap((x) => x.sets).filter((s) => s.type !== 'warmup');
      if (!work.length) return [];
      const v =
        metric === 'heaviest' ? (countsLoad(kind) ? Math.max(...work.map((s) => s.kg ?? 0)) : 0)
        : metric === 'orm' ? (isWeightReps(kind) ? Math.max(...work.map((s) => oneRM(s.kg ?? 0, s.reps ?? 0))) : 0)
        : metric === 'setVolume' ? Math.max(...work.map((s) => setVolume(s, kind)))
        : metric === 'reps' ? Math.max(...work.map((s) => s.reps ?? 0))
        : work.reduce((a, s) => a + setVolume(s, kind), 0);
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
    // reps: só exercícios com repetições de verdade (no `duration` antigo, `reps` são segundos)
    const value = inWeek.reduce(
      (t, w) => t + (metric === 'duration' ? w.durationSec / 3600 : metric === 'volume' ? workoutVolume(w) : w.entries.reduce((a, e) => (hasReps(kindOf(e.exerciseId)) ? a + e.sets.reduce((b, s) => b + (s.reps ?? 0), 0) : a), 0)),
      0,
    );
    return { label: from.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' }), value };
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

export function muscleDistribution(workouts: Workout[], exercises: Exercise[], sinceDays?: number, now = 0) {
  const from = sinceDays ? (now || new Date().getTime()) - sinceDays * 86400000 : 0;
  const map = new Map<string, number>();
  for (const w of workouts) {
    if (new Date(w.date).getTime() < from) continue;
    for (const e of w.entries) {
      // pelo lookup do store (aceita o `cat:<id>` de treinos na fila); a lista recebida fica de reserva
      const ex = exerciseOf(e.exerciseId) ?? exercises.find((x) => x.id === e.exerciseId);
      if (!ex) continue;
      const g = MUSCLE_GROUPS[ex.muscle] ?? ex.muscle;
      map.set(g, (map.get(g) ?? 0) + e.sets.length);
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map].map(([name, sets]) => ({ name, sets, pct: Math.round((sets / total) * 100) })).sort((a, b) => b.sets - a.sets);
}
