import { Exercise, RoutineExercise } from './types';

export type Goal = 'hypertrophy' | 'strength' | 'fatloss';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Gear = 'gym' | 'dumbbell' | 'body';
export type PlanOpts = { goal: Goal; days: number; level: Level; gear: Gear; seed: number };
export type PlannedRoutine = { title: string; notes: string; exercises: RoutineExercise[] };

type Kind = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';
const SLOTS: Record<Kind, [string, number][]> = {
  push: [['Chest', 2], ['Shoulders', 2], ['Triceps', 1]],
  pull: [['Back', 3], ['Biceps', 2]],
  legs: [['Quads', 2], ['Hamstrings', 1], ['Glutes', 1], ['Calves', 1]],
  upper: [['Chest', 1], ['Back', 2], ['Shoulders', 1], ['Biceps', 1], ['Triceps', 1]],
  lower: [['Quads', 2], ['Hamstrings', 1], ['Glutes', 1], ['Calves', 1]],
  full: [['Quads', 1], ['Chest', 1], ['Back', 1], ['Shoulders', 1], ['Abs', 1]],
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
  hypertrophy: { sets: 3, reps: 10, rest: 90, label: 'Hypertrophy' },
  strength: { sets: 5, reps: 5, rest: 180, label: 'Strength' },
  fatloss: { sets: 3, reps: 15, rest: 45, label: 'Fat loss' },
};
const PER_LEVEL: Record<Level, number> = { beginner: 4, intermediate: 5, advanced: 6 };

// Exercícios clássicos por músculo (nome em inglês do catálogo), usados pelo gerador de planos.
const STAPLES: Record<string, string[]> = {
  "Chest": [
    "barbell bench press",
    "dumbbell bench press",
    "barbell incline bench press",
    "dumbbell incline bench press",
    "push-up",
    "decline push-up",
    "chest dip",
    "dumbbell fly",
    "lever chest press",
    "band bench press",
    "barbell decline bench press",
    "cable cross-over variation",
    "dumbbell incline fly",
    "incline push-up",
    "diamond push-up",
    "dumbbell decline bench press"
  ],
  "Back": [
    "pull-up",
    "chin-up",
    "barbell bent over row",
    "cable seated row",
    "lever seated row",
    "cable lat pulldown full range of motion",
    "dumbbell bent over row",
    "barbell deadlift",
    "inverted row",
    "dumbbell one arm bent-over row",
    "dumbbell reverse fly",
    "lever t bar row",
    "dumbbell shrug",
    "barbell shrug",
    "cable pulldown (pro lat bar)",
    "dumbbell deadlift",
    "body-up"
  ],
  "Shoulders": [
    "dumbbell standing overhead press",
    "barbell seated overhead press",
    "dumbbell lateral raise",
    "dumbbell front raise",
    "dumbbell rear lateral raise",
    "lever shoulder press",
    "band shoulder press",
    "cable lateral raise",
    "dumbbell seated shoulder press",
    "barbell front raise",
    "dumbbell arnold press",
    "dumbbell upright row",
    "barbell upright row",
    "cable standing rear delt row (with rope)",
    "band front raise",
    "handstand push-up"
  ],
  "Biceps": [
    "barbell curl",
    "dumbbell biceps curl",
    "dumbbell hammer curl",
    "dumbbell alternate biceps curl",
    "cable curl",
    "ez barbell curl",
    "dumbbell concentration curl",
    "barbell preacher curl",
    "dumbbell incline curl",
    "band alternating biceps curl",
    "dumbbell preacher curl",
    "cable hammer curl (with rope)",
    "chin-up"
  ],
  "Triceps": [
    "cable pushdown",
    "triceps dip",
    "bench dip (knees bent)",
    "close-grip push-up",
    "barbell lying triceps extension",
    "dumbbell kickback",
    "dumbbell seated triceps extension",
    "cable overhead triceps extension (rope attachment)",
    "barbell close-grip bench press",
    "dumbbell lying triceps extension",
    "diamond push-up",
    "weighted bench dip"
  ],
  "Quads": [
    "barbell full squat",
    "barbell front squat",
    "lever alternate leg press",
    "lever leg extension",
    "dumbbell goblet squat",
    "barbell lunge",
    "dumbbell lunge",
    "dumbbell squat",
    "smith squat",
    "jump squat",
    "band squat",
    "barbell step-up",
    "dumbbell step-up",
    "walking lunge"
  ],
  "Hamstrings": [
    "barbell romanian deadlift",
    "dumbbell romanian deadlift",
    "lever lying leg curl",
    "lever seated leg curl",
    "barbell good morning",
    "dumbbell stiff leg deadlift",
    "band stiff leg deadlift",
    "barbell deadlift"
  ],
  "Glutes": [
    "barbell glute bridge",
    "glute bridge march",
    "low glute bridge on floor",
    "cable kickback",
    "band hip lift",
    "dumbbell goblet squat",
    "smith sumo squat",
    "barbell sumo deadlift",
    "glute bridge two legs on bench (male)"
  ],
  "Calves": [
    "barbell standing calf raise",
    "lever seated calf raise",
    "bodyweight standing calf raise",
    "lever standing calf raise",
    "donkey calf raise",
    "dumbbell standing calf raise",
    "barbell seated calf raise"
  ],
  "Abs": [
    "crunch floor",
    "hanging leg raise",
    "russian twist",
    "lever seated crunch",
    "dumbbell side bend",
    "reverse crunch",
    "cable twist",
    "weighted crunch",
    "decline sit-up",
    "mountain climber"
  ]
};

const rng = (seed: number) => { let s = seed || 1; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); };

export function generatePlan(o: PlanOpts, exercises: Exercise[], enOf?: (e: Exercise) => string | undefined): { name: string; routines: PlannedRoutine[] } {
  const rand = rng(o.seed);
  const p = PARAMS[o.goal];
  const allowed = (e: Exercise) => o.gear === 'gym' ? e.equipment !== 'Other' : o.gear === 'dumbbell' ? ['Dumbbell', 'Body weight', 'Band', 'Kettlebell'].includes(e.equipment) : e.equipment === 'Body weight';
  const byEn = new Map<string, Exercise>();
  exercises.forEach((e) => { const n = enOf?.(e); if (n) byEn.set(n.toLowerCase(), e); });
  const loose = /bench press|squat|deadlift|row\b|pulldown|pull-up|chin-up|push-up|dip\b|curl|press|raise|extension|fly\b|lunge|crunch|thrust|bridge|pushdown|calf/;
  const noisy = /punch|jab|hook|boxing|\(2\)|bradford|assisted|stability ball|exercise ball|bosu|wheel|isometric|one arm|one leg|single|kneeling|v\. \d|male|stretch|\bhold\b|jerk|clean|snatch/;
  const pool = (muscle: string) => {
    const staples = (STAPLES[muscle] ?? []).flatMap((n) => byEn.get(n) ?? []).filter(allowed);
    if (staples.length) return staples;
    // sem clássico para esse equipamento: tenta algo comum do mesmo músculo, senão pula o grupo
    return exercises.filter((e) => e.muscle === muscle && allowed(e) && e.kind !== 'duration' && enOf && loose.test((enOf(e) ?? '').toLowerCase()) && !noisy.test((enOf(e) ?? '').toLowerCase())).slice(0, 6);
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
    return { title: `${LABEL[k]}${letter}`, notes: `${p.label} · ${p.sets}×${p.reps} · ${p.rest}s rest`, exercises: exs };
  });
  return { name: `${p.label} ${o.days}x/week`, routines };
}
