import { randomUUID } from './uuid';
import { STAPLES } from './planner';
import { Exercise, TrainerExercise, TrainerGoal, TrainerProgram, TrainerSettings, TrainerSplit, TrainerWorkout } from './types';

export const CYCLE_WEEKS = 6;

export const DEFAULT_TRAINER: TrainerSettings = {
  level: 'intermediate', preset: 'commercial', equipment: [], focus: null, duration: 60, rest: 'medium', variety: 'balanced', deload: false,
  cardio: false, cardioWhere: 'end', excluded: [], injuries: [], split: 'fullbody', goal: 'hypertrophy', frequency: 3,
};

export const LEVELS = [{ id: 'beginner', label: 'Beginner', sub: '0-1 year' }, { id: 'intermediate', label: 'Intermediate', sub: '1-3 years' }, { id: 'advanced', label: 'Advanced', sub: '3+ years' }] as const;
export const GOALS = [{ id: 'strength', label: 'Gain Strength' }, { id: 'hypertrophy', label: 'Build Muscle' }, { id: 'fatloss', label: 'Lose Fat' }] as const;
export const FOCUS = ['Core', 'Chest', 'Arms', 'Legs', 'Shoulders', 'Back'] as const;
const FOCUS_MUSCLES: Record<string, string[]> = { Core: ['Abs'], Chest: ['Chest'], Arms: ['Biceps', 'Triceps'], Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'], Shoulders: ['Shoulders'], Back: ['Back'] };
export const DURATIONS = [{ v: 40, rec: true }, { v: 60 }, { v: 80 }] as const;
export const RESTS = [{ id: 'short', label: 'Short', sub: '1min 30s - 2min 30s', sec: 90 }, { id: 'medium', label: 'Medium', sub: '2min 0s - 3min 0s', sec: 120 }, { id: 'long', label: 'Long', sub: '2min 0s - 4min 0s', sec: 180 }] as const;
export const VARIETY = [
  { id: 'balanced', label: 'Balanced', sub: 'Same exercises for a focused 6-week block, then the plan refreshes with new exercises.' },
  { id: 'consistent', label: 'Consistent', sub: 'Same exercises every week. Best for progressing on specific lifts.' },
  { id: 'varied', label: 'Varied', sub: 'New exercises every week for maximum variety.' },
] as const;
export const SPLITS: { id: TrainerSplit; label: string; sub: string; days: number[] }[] = [
  { id: 'pplul', label: 'Push Pull Legs Upper Lower', sub: 'Combine Push Pull Legs with Upper / Lower for a higher-frequency routine.', days: [5] },
  { id: 'fullbody', label: 'Full Body', sub: 'Train your whole body each session with a simple, balanced plan.', days: [2, 3, 4, 5, 6] },
  { id: 'ul', label: 'Upper / Lower', sub: 'Alternate upper and lower body days for focused training and recovery.', days: [2, 4, 6] },
  { id: 'ppl', label: 'Push Pull Legs', sub: 'Group workouts by movement pattern for more volume and structure.', days: [3, 6] },
];
export const splitLabel = (s: TrainerSplit) => SPLITS.find((x) => x.id === s)!.label;
export const goalLabel = (g: TrainerGoal) => GOALS.find((x) => x.id === g)!.label;

/** Divisão sugerida para a frequência (usada ao mudar os dias e a divisão atual não existir). */
export const bestSplit = (days: number): TrainerSplit => (days === 5 ? 'pplul' : days === 3 ? 'ppl' : days === 4 || days === 2 ? 'ul' : 'ppl');

export type EquipItem = { id: string; label: string; group: string; icon: string; sub?: string };
export const EQUIP: EquipItem[] = [
  { id: 'dumbbell', label: 'Dumbbell', group: 'Weights and Bars', icon: 'barbell-outline', sub: '2.5kg, 5kg, 7.5kg...' }, { id: 'barbell', label: 'Barbell', group: 'Weights and Bars', icon: 'remove-outline', sub: '20kg' },
  { id: 'plate', label: 'Plate', group: 'Weights and Bars', icon: 'disc-outline', sub: '1.25kg, 2.5kg, 5kg...' }, { id: 'kettlebell', label: 'Kettlebell', group: 'Weights and Bars', icon: 'basketball-outline' },
  { id: 'ezbar', label: 'EZ Bar', group: 'Weights and Bars', icon: 'remove-outline' }, { id: 'landmine', label: 'Landmine', group: 'Weights and Bars', icon: 'trending-up-outline' }, { id: 'trapbar', label: 'Trap Bar', group: 'Weights and Bars', icon: 'resize-outline' },
  { id: 'pullup', label: 'Pull Up Bar', group: 'Benches and Racks', icon: 'remove-outline' }, { id: 'rack', label: 'Squat Rack', group: 'Benches and Racks', icon: 'grid-outline' },
  { id: 'flatbench', label: 'Flat Bench', group: 'Benches and Racks', icon: 'bed-outline' }, { id: 'adjbench', label: 'Adjustable Bench', group: 'Benches and Racks', icon: 'bed-outline' }, { id: 'dipbar', label: 'Dip Bar', group: 'Benches and Racks', icon: 'accessibility-outline' },
  { id: 'cable1', label: 'Single Cable Machine', group: 'Machines', icon: 'git-merge-outline' }, { id: 'cable2', label: 'Dual Cable Machine', group: 'Machines', icon: 'git-compare-outline' }, { id: 'latpull', label: 'Lat Pulldown Cable', group: 'Machines', icon: 'arrow-down-outline' },
  { id: 'legpress', label: 'Leg Press Machine', group: 'Machines', icon: 'fitness-outline' }, { id: 'smith', label: 'Smith Machine', group: 'Machines', icon: 'grid-outline' }, { id: 'tbar', label: 'T-bar', group: 'Machines', icon: 'remove-outline' },
  { id: 'stack', label: 'Stack Machines', group: 'Machines', icon: 'layers-outline' }, { id: 'platem', label: 'Plate Machines', group: 'Machines', icon: 'disc-outline' },
  { id: 'treadmill', label: 'Treadmill', group: 'Cardio', icon: 'walk-outline' }, { id: 'rower', label: 'Rowing Machine', group: 'Cardio', icon: 'boat-outline' }, { id: 'spin', label: 'Spinning', group: 'Cardio', icon: 'bicycle-outline' },
  { id: 'elliptical', label: 'Elliptical Trainer', group: 'Cardio', icon: 'footsteps-outline' }, { id: 'stairs', label: 'Stair Machine', group: 'Cardio', icon: 'trending-up-outline' }, { id: 'airbike', label: 'Air Bike', group: 'Cardio', icon: 'bicycle-outline' },
  { id: 'susp', label: 'Suspension Band', group: 'Other', icon: 'link-outline' }, { id: 'band', label: 'Resistance Band', group: 'Other', icon: 'reorder-two-outline' }, { id: 'rope', label: 'Battle Rope', group: 'Other', icon: 'infinite-outline' },
  { id: 'rings', label: 'Rings', group: 'Other', icon: 'ellipse-outline' }, { id: 'jumprope', label: 'Jump Rope', group: 'Other', icon: 'infinite-outline' }, { id: 'medball', label: 'Medicine Ball', group: 'Other', icon: 'football-outline' }, { id: 'other', label: 'Other', group: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];
const ALL_IDS = EQUIP.map((e) => e.id);
export const PRESETS: { id: string; label: string; ids: string[] }[] = [
  { id: 'custom', label: 'Custom', ids: [] },
  { id: 'home', label: 'At Home', ids: ['dumbbell', 'adjbench', 'band', 'pullup', 'kettlebell'] },
  { id: 'garage', label: 'Garage Gym', ids: ['dumbbell', 'barbell', 'plate', 'rack', 'flatbench', 'adjbench', 'pullup', 'kettlebell', 'band', 'dipbar'] },
  { id: 'commercial', label: 'Commercial Gym', ids: ALL_IDS.filter((i) => !['landmine', 'trapbar', 'rings', 'susp', 'rope', 'other'].includes(i)) },
  { id: 'large', label: 'Large Gym', ids: ALL_IDS },
];
export const presetIds = (id: string) => PRESETS.find((p) => p.id === id)?.ids ?? [];

/** Equipamentos do catálogo (campo `equipment`) liberados pelo que o usuário tem. */
export function allowedEquipment(ids: string[]) {
  const has = (...x: string[]) => x.some((i) => ids.includes(i));
  const a = new Set<string>(['Body weight']);
  if (has('dumbbell')) a.add('Dumbbell');
  if (has('barbell', 'ezbar', 'landmine', 'trapbar', 'plate')) a.add('Barbell');
  if (has('kettlebell')) a.add('Kettlebell');
  if (has('band', 'susp')) a.add('Band');
  if (has('cable1', 'cable2', 'latpull')) a.add('Cable');
  if (has('legpress', 'smith', 'tbar', 'stack', 'platem')) a.add('Machine');
  return a;
}

export const INJURIES: { id: string; label: string; avoid: RegExp }[] = [
  { id: 'shoulder', label: 'Shoulder', avoid: /overhead|shoulder press|\bdip\b|upright row|arnold|handstand|behind|military/ },
  { id: 'elbow', label: 'Elbow', avoid: /skull|lying triceps|close-grip|\bdip\b|preacher|french/ },
  { id: 'wrist', label: 'Wrist', avoid: /push-up|curl|front squat|handstand|front raise/ },
  { id: 'lowerback', label: 'Lower back', avoid: /deadlift|good morning|bent over|bent-over|clean|snatch|romanian/ },
  { id: 'knee', label: 'Knee', avoid: /squat|lunge|jump|step-up|leg extension/ },
  { id: 'hip', label: 'Hip', avoid: /deadlift|sumo|lunge|hip thrust|glute bridge/ },
  { id: 'ankle', label: 'Ankle', avoid: /jump|calf|lunge|step-up/ },
  { id: 'neck', label: 'Neck', avoid: /shrug|upright row|behind/ },
];

type Kind = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';
const SLOTS: Record<Kind, [string, number][]> = {
  push: [['Chest', 2], ['Shoulders', 2], ['Triceps', 1], ['Abs', 1]], pull: [['Back', 3], ['Biceps', 2], ['Abs', 1]],
  legs: [['Quads', 2], ['Hamstrings', 1], ['Glutes', 1], ['Calves', 1], ['Abs', 1]], upper: [['Chest', 1], ['Back', 2], ['Shoulders', 1], ['Biceps', 1], ['Triceps', 1]],
  lower: [['Quads', 2], ['Hamstrings', 1], ['Glutes', 1], ['Calves', 1], ['Abs', 1]], full: [['Quads', 1], ['Chest', 1], ['Back', 1], ['Shoulders', 1], ['Hamstrings', 1], ['Biceps', 1], ['Triceps', 1], ['Calves', 1], ['Abs', 1]],
};
const LABEL: Record<Kind, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower', full: 'Full Body' };
const DESC: Record<Kind, string> = {
  push: 'This workout includes compound lifts for the chest and shoulders, plus isolation exercises for the triceps and abs.',
  pull: 'This session primarily focuses on the upper back and lats with some additional work for the biceps.',
  legs: 'This workout puts equal emphasis on the quads, hamstrings, and calves, along with some direct ab work.',
  upper: 'This upper session focuses on the chest, back, and lats, with extra isolation work for the shoulders.',
  lower: 'This workout focuses more on the glutes and quads, but also includes direct quad and calf exercises.',
  full: 'A balanced session that trains your whole body with compound lifts and a few isolation exercises.',
};
const COMPOUND = /press|squat|deadlift|row\b|pull-up|chin-up|dip\b|lunge|thrust|clean|push-up|pulldown/;

export function kindsFor(split: TrainerSplit, days: number): Kind[] {
  if (split === 'pplul') return ['push', 'pull', 'legs', 'upper', 'lower'];
  if (split === 'fullbody') return Array.from({ length: days }, () => 'full' as Kind);
  if (split === 'ul') return Array.from({ length: days }, (_, i) => (i % 2 === 0 ? 'upper' : 'lower') as Kind);
  return Array.from({ length: days }, (_, i) => (['push', 'pull', 'legs'] as Kind[])[i % 3]);
}

const rng = (seed: number) => { let s = seed || 1; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); };

/** Séries semanais por músculo no programa (uma passada por todos os treinos = 1 semana). */
export function weeklySets(workouts: TrainerWorkout[], find: (id: string) => Exercise | undefined) {
  const m = new Map<string, number>();
  workouts.forEach((w) => w.exercises.forEach((e) => { const x = find(e.exerciseId); if (x && x.muscle !== 'Cardio') m.set(x.muscle, (m.get(x.muscle) ?? 0) + e.sets); }));
  return m;
}
export const VOLUME_MIN = 10, VOLUME_MAX = 20;
/** Mínimo semanal por músculo: grupos grandes 10; menores (panturrilha, glúteo, abdômen) têm piso menor. */
export const volumeMin = (muscle: string) => (muscle === 'Calves' ? 8 : muscle === 'Abs' || muscle === 'Glutes' ? 6 : VOLUME_MIN);
const MAIN_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Biceps', 'Triceps', 'Calves', 'Glutes', 'Abs'];

/** Ajusta o volume: músculos principais abaixo de 10 séries/semana ganham séries (máx. 5 por exercício); acima de 20 perdem. */
function balanceVolume(workouts: TrainerWorkout[], find: (id: string) => Exercise | undefined, more: (muscle: string, have: Set<string>) => TrainerExercise | null) {
  const totals = weeklySets(workouts, find);
  for (const mu of MAIN_MUSCLES) {
    const list = workouts.flatMap((w) => w.exercises).filter((e) => find(e.exerciseId)?.muscle === mu);
    if (!list.length) continue;
    let guard = 0;
    while ((totals.get(mu) ?? 0) < volumeMin(mu) && guard++ < 30) {
      const e = list.filter((x) => x.sets < 5).sort((a, b) => a.sets - b.sets)[0];
      if (!e) {
        // todos os exercícios do músculo já estão no teto: adiciona outro exercício no treino onde ele aparece
        const w = workouts.find((x) => x.exercises.some((y) => find(y.exerciseId)?.muscle === mu && y.sets >= 5));
        const add = w ? more(mu, new Set(w.exercises.map((y) => y.exerciseId))) : null;
        if (!w || !add) break;
        const at = w.exercises.map((y) => find(y.exerciseId)?.muscle).lastIndexOf(mu);
        w.exercises.splice(at + 1, 0, add); list.push(add);
        totals.set(mu, (totals.get(mu) ?? 0) + add.sets);
        continue;
      }
      e.sets += 1; totals.set(mu, (totals.get(mu) ?? 0) + 1);
    }
    guard = 0;
    while ((totals.get(mu) ?? 0) > VOLUME_MAX && guard++ < 30) {
      const e = list.filter((x) => x.sets > 2).sort((a, b) => b.sets - a.sets)[0];
      if (!e) break;
      e.sets -= 1; totals.set(mu, (totals.get(mu) ?? 0) - 1);
    }
  }
}

/** Progressão dupla: sobe a carga quando todas as séries bateram o topo da faixa; senão tenta +1 rep. */
export function suggestSets(last: { type: string; kg: number | null; reps: number | null }[], e: { sets: number; repMin: number; repMax: number; kind: string }, equipment: string) {
  const work = last.filter((x) => x.type !== 'warmup');
  if (!work.length || e.kind === 'duration') return null;
  const top = Math.max(...work.map((x) => x.kg ?? 0));
  const inc = equipment === 'Dumbbell' || equipment === 'Kettlebell' ? 2 : equipment === 'Body weight' ? 0 : 2.5;
  const allTop = work.every((x) => (x.reps ?? 0) >= e.repMax);
  return Array.from({ length: e.sets }, (_, j) => {
    const p = work[Math.min(j, work.length - 1)];
    if (allTop) return { kg: top > 0 ? top + inc : null, reps: top > 0 ? e.repMin : e.repMax };
    return { kg: p.kg, reps: Math.min(e.repMax, Math.max(e.repMin, (p.reps ?? e.repMin) + 1)) };
  });
}

export function programSummary(s: TrainerSettings) {
  const focus = s.focus ? ` with a special focus on the ${s.focus}` : '';
  return `This is a ${s.frequency}-day ${splitLabel(s.split)} program that targets all your muscle groups${focus}, designed for ${s.goal === 'strength' ? 'strength gain' : s.goal === 'hypertrophy' ? 'muscle growth' : 'fat loss'}.`;
}

export function generateProgram(s: TrainerSettings, exercises: Exercise[], enOf: (e: Exercise) => string | undefined, seed: number, name: string, cycle = 1, prev?: TrainerProgram | null): TrainerProgram {
  const rand = rng(seed * 7919 + cycle);
  const allowedEq = allowedEquipment(s.equipment);
  const avoid = s.injuries.map((i) => INJURIES.find((x) => x.id === i)?.avoid).filter(Boolean) as RegExp[];
  const byEn = new Map<string, Exercise>();
  exercises.forEach((e) => { const n = enOf(e); if (n) byEn.set(n.toLowerCase(), e); });
  const bad = (e: Exercise) => s.excluded.includes(e.id) || avoid.some((r) => r.test((enOf(e) ?? e.name).toLowerCase()));
  const ok = (e: Exercise) => allowedEq.has(e.equipment) && !bad(e);
  const loose = /bench press|squat|deadlift|row\b|pulldown|pull-up|chin-up|push-up|dip\b|curl|press|raise|extension|fly\b|lunge|crunch|thrust|bridge|pushdown|calf/;
  const noisy = /punch|jab|hook|boxing|\(2\)|bradford|assisted|stability ball|exercise ball|bosu|wheel|isometric|one arm|one leg|single|kneeling|v\. \d|male|stretch|\bhold\b|jerk|clean|snatch|kick|inside|outside|pike|cobra/;
  const lower = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
  const pool = (muscle: string) => {
    const st = (STAPLES[muscle] ?? []).flatMap((n) => byEn.get(n) ?? []).filter((e) => ok(e) && e.muscle === muscle);
    if (st.length >= 2) return st;
    const extra = exercises.filter((e) => e.muscle === muscle && ok(e) && e.kind !== 'duration' && loose.test((enOf(e) ?? '').toLowerCase()) && !noisy.test((enOf(e) ?? '').toLowerCase()) && !(lower.includes(muscle) && /push-up|pull-up|\bdip\b/.test((enOf(e) ?? '').toLowerCase()))).slice(0, 8);
    return [...st, ...extra];
  };
  const shuffle = <T,>(a: T[]) => a.map((x) => [rand(), x] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const prevSet = new Set(cycle > 1 && prev ? prev.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)) : []);
  const restBase = RESTS.find((r) => r.id === s.rest)!.sec;
  const target = s.duration === 40 ? 4 : s.duration === 60 ? 6 : 8;
  const sets = s.level === 'beginner' ? 2 : 3;
  const focusM = s.focus ? FOCUS_MUSCLES[s.focus] : [];
  const toTE = (e: Exercise): TrainerExercise => {
    const comp = COMPOUND.test((enOf(e) ?? '').toLowerCase());
    const [lo, hi] = s.goal === 'strength' ? (comp ? [4, 6] : [10, 12]) : s.goal === 'hypertrophy' ? (comp ? [6, 10] : [10, 15]) : [12, 15];
    return { exerciseId: e.id, sets: s.goal === 'strength' && comp ? sets + 1 : sets, repMin: lo, repMax: hi, restSec: e.kind === 'reps' ? Math.min(60, restBase) : restBase, kind: e.kind };
  };
  const kinds = kindsFor(s.split, s.frequency);
  const seen: Record<string, number> = {};
  const used = new Set<string>();
  const workouts: TrainerWorkout[] = kinds.map((k) => {
    seen[k] = (seen[k] ?? 0) + 1;
    const dup = kinds.filter((x) => x === k).length > 1;
    const letter = dup && k !== 'full' ? ` ${'ABC'[seen[k] - 1] ?? seen[k]}` : dup ? ` ${seen[k]}` : '';
    const chosen: Exercise[] = [];
    const take = (muscle: string, n: number) => {
      const c = shuffle(pool(muscle)).sort((a, b) => Number(prevSet.has(a.id)) - Number(prevSet.has(b.id)));
      c.filter((e) => !chosen.includes(e)).slice(0, n).forEach((e) => chosen.push(e));
    };
    // corpo inteiro: gira a ordem dos músculos a cada dia para cobrir todos ao longo da semana
    const rot = k === 'full' ? ((seen[k] - 1) * 3) % SLOTS.full.length : 0;
    const slots = k === 'full' ? [...SLOTS.full.slice(rot), ...SLOTS.full.slice(0, rot)] : SLOTS[k];
    for (const [m, n] of slots) take(m, n);
    const fm = slots.map((x) => x[0]).find((m) => focusM.includes(m));
    if (fm) take(fm, 1 + chosen.filter((e) => e.muscle === fm).length);
    const list = chosen.slice(0, target + (fm ? 1 : 0));
    list.forEach((e) => used.add(e.id));
    const exs: TrainerExercise[] = list.map(toTE);
    if (s.cardio) {
      const c = exercises.find((e) => e.muscle === 'Cardio' && e.kind === 'duration' && !bad(e) && /bike|jump rope|run|treadmill|rower|row/.test((enOf(e) ?? '').toLowerCase())) ?? exercises.find((e) => e.muscle === 'Cardio' && !bad(e));
      if (c) { const ce: TrainerExercise = { exerciseId: c.id, sets: 1, repMin: 600, repMax: 600, restSec: 0, kind: c.kind }; if (s.cardioWhere === 'start') exs.unshift(ce); else exs.push(ce); }
    }
    return { uid: randomUUID(), kind: k, title: `${LABEL[k]}${letter}`, notes: DESC[k], exercises: exs };
  });
  balanceVolume(workouts, (id) => exercises.find((e) => e.id === id), (muscle, have) => {
    const c = shuffle(pool(muscle)).find((e) => !have.has(e.id));
    return c ? { ...toTE(c), sets: 3 } : null;
  });
  return { id: prev?.id ?? randomUUID(), name, startedAt: prev && cycle > 1 ? new Date().toISOString() : new Date().toISOString(), cycle, seed, completed: 0, settings: s, workouts, nextUid: workouts[0]?.uid ?? '' };
}
