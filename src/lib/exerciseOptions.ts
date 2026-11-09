import type { GymIcon } from './gymIcons';
import { fmtClock, fmtDist, fmtWeight, fromDisplayDist, toDisplayDist } from './format';
import { ExerciseKind, SetRow, Units } from './types';

/** Opções do fluxo "Create Exercise". `value` é o que fica salvo (mesmos nomes do catálogo). */
export const EQUIPMENT_OPTIONS: { label: string; value: string; icon: GymIcon }[] = [
  { label: 'None', value: 'Body weight', icon: 'bodyweight' },
  { label: 'Barbell', value: 'Barbell', icon: 'barbell' },
  { label: 'Dumbbell', value: 'Dumbbell', icon: 'dumbbell' },
  { label: 'Kettlebell', value: 'Kettlebell', icon: 'kettlebell' },
  { label: 'Machine', value: 'Machine', icon: 'machine' },
  { label: 'Cable', value: 'Cable', icon: 'cable' },
  { label: 'Plate', value: 'Plate', icon: 'plate' },
  { label: 'Resistance Band', value: 'Band', icon: 'band' },
  { label: 'Suspension Band', value: 'Suspension band', icon: 'suspension' },
  { label: 'Other', value: 'Other', icon: 'other' },
];

/** `muscle` = grupo usado nas listas/filtros/Trainer; `target` = músculo específico do catálogo (para os filtros finos). */
export const MUSCLE_OPTIONS: { label: string; muscle: string; target?: string }[] = [
  { label: 'Abdominals', muscle: 'Abs' },
  { label: 'Abductors', muscle: 'Glutes', target: 'Abductors' },
  { label: 'Adductors', muscle: 'Glutes', target: 'Adductors' },
  { label: 'Biceps', muscle: 'Biceps' },
  { label: 'Calves', muscle: 'Calves' },
  { label: 'Cardio', muscle: 'Cardio' },
  { label: 'Chest', muscle: 'Chest' },
  { label: 'Forearms', muscle: 'Forearms' },
  { label: 'Full Body', muscle: 'Full body' },
  { label: 'Glutes', muscle: 'Glutes' },
  { label: 'Hamstrings', muscle: 'Hamstrings' },
  { label: 'Lats', muscle: 'Back', target: 'Lats' },
  { label: 'Lower Back', muscle: 'Back', target: 'Spine' },
  { label: 'Neck', muscle: 'Shoulders', target: 'Levator scapulae' },
  { label: 'Quadriceps', muscle: 'Quads' },
  { label: 'Shoulders', muscle: 'Shoulders' },
  { label: 'Traps', muscle: 'Back', target: 'Traps' },
  { label: 'Triceps', muscle: 'Triceps' },
  { label: 'Upper Back', muscle: 'Back', target: 'Upper back' },
  { label: 'Other', muscle: 'Other' },
];

export const EXERCISE_TYPES: { kind: ExerciseKind; label: string; example: string; chips: string[]; suggested?: boolean; soon?: boolean }[] = [
  { kind: 'weight_reps', label: 'Weight & Reps', example: 'Bench Press, Dumbbell Curls', chips: ['Reps', 'Kg'], suggested: true },
  { kind: 'reps', label: 'Bodyweight Reps', example: 'Pullups, Sit ups, Burpees', chips: ['Reps'] },
  { kind: 'weighted_bodyweight', label: 'Weighted Bodyweight', example: 'Weighted Pull Ups, Weighted Dips', chips: ['Reps', '+Kg'] },
  { kind: 'assisted_bodyweight', label: 'Assisted Bodyweight', example: 'Assisted Pullups, Assisted Dips', chips: ['Reps', '-Kg'] },
  { kind: 'duration', label: 'Duration', example: 'Planks, Yoga, Stretching', chips: ['Time'] },
  { kind: 'duration_weight', label: 'Duration & Weight', example: 'Weighted Plank, Wall Sit', chips: ['Kg', 'Time'] },
  { kind: 'distance_duration', label: 'Distance & Duration', example: 'Running, Cycling, Rowing', chips: ['Time', 'Km'] },
  { kind: 'weight_distance', label: 'Weight & Distance', example: 'Farmers Walk, Suitcase Carry', chips: ['Kg', 'Km'] },
];

/** Tipos que registram peso (kg). */
export const hasWeight = (kind: ExerciseKind | undefined) => kind !== 'reps' && kind !== 'duration' && kind !== 'distance_duration';

/** Colunas depois do peso: repetições (ou segundos no `duration` antigo), segundos, minutos ou distância. */
export type SetCol = 'reps' | 'sec' | 'min' | 'dist';
export const setCols = (kind: ExerciseKind | undefined): SetCol[] =>
  kind === 'duration_weight' ? ['sec'] : kind === 'distance_duration' ? ['dist', 'min'] : kind === 'weight_distance' ? ['dist'] : ['reps'];
export const colHeader = (col: SetCol, kind: ExerciseKind | undefined, u: Units) =>
  col === 'reps' ? (kind === 'duration' ? 'SEC' : 'REPS') : col === 'sec' ? 'SEC' : col === 'min' ? 'MIN' : u.distance.toUpperCase();
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Valor da coluna na unidade da tela. */
export const colValue = (s: SetRow, col: SetCol, u: Units): number | null =>
  col === 'reps' ? s.reps : col === 'sec' ? s.seconds ?? null : col === 'min' ? (s.seconds == null ? null : r2(s.seconds / 60)) : s.distM == null ? null : r2(toDisplayDist(s.distM, u));
/** Valor digitado → campos da série. */
export const colPatch = (col: SetCol, v: number | null, u: Units): Partial<SetRow> =>
  col === 'reps' ? { reps: v } : col === 'sec' ? { seconds: v } : col === 'min' ? { seconds: v == null ? null : Math.round(v * 60) } : { distM: v == null ? null : fromDisplayDist(v, u) };
export const colDecimal = (col: SetCol) => col === 'min' || col === 'dist';
/** A série tem algum valor (peso, repetições, tempo ou distância). */
/** Uma série em texto conforme o tipo: "60 kg × 8", "0:45", "5 km · 25:00", "40 kg × 50 m". */
export const fmtSet = (s: SetRow, kind: ExerciseKind | undefined, u: Units) => {
  const kg = (s.kg ?? 0) > 0 ? fmtWeight(s.kg!, u) : '';
  const t = fmtClock(s.seconds ?? 0), d = fmtDist(s.distM ?? 0, u);
  if (kind === 'duration_weight') return kg ? `${kg} × ${t}` : t;
  if (kind === 'distance_duration') return `${d} · ${t}`;
  if (kind === 'weight_distance') return kg ? `${kg} × ${d}` : d;
  if (kind === 'duration') return fmtClock(s.reps ?? 0);
  return kg ? `${kg} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
};
export const setHasValue = (s: SetRow) => (s.kg ?? 0) > 0 || (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0 || (s.distM ?? 0) > 0;
/** Rótulo da coluna de peso no treino: KG, +KG (com peso extra) ou -KG (com ajuda). */
export const weightHeader = (kind: ExerciseKind | undefined, unit: string) => `${kind === 'weighted_bodyweight' ? '+' : kind === 'assisted_bodyweight' ? '-' : ''}${unit.toUpperCase()}`;
export const kindLabel = (kind: ExerciseKind) => EXERCISE_TYPES.find((t) => t.kind === kind)?.label ?? '';
