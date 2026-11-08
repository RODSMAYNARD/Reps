import type { GymIcon } from './gymIcons';
import { ExerciseKind } from './types';

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

/** `soon`: ainda não dá para registrar distância (o treino guarda só kg, repetições e tempo). */
export const EXERCISE_TYPES: { kind: ExerciseKind | 'duration_weight' | 'distance_duration' | 'weight_distance'; label: string; example: string; chips: string[]; suggested?: boolean; soon?: boolean }[] = [
  { kind: 'weight_reps', label: 'Weight & Reps', example: 'Bench Press, Dumbbell Curls', chips: ['Reps', 'Kg'], suggested: true },
  { kind: 'reps', label: 'Bodyweight Reps', example: 'Pullups, Sit ups, Burpees', chips: ['Reps'] },
  { kind: 'weighted_bodyweight', label: 'Weighted Bodyweight', example: 'Weighted Pull Ups, Weighted Dips', chips: ['Reps', '+Kg'] },
  { kind: 'assisted_bodyweight', label: 'Assisted Bodyweight', example: 'Assisted Pullups, Assisted Dips', chips: ['Reps', '-Kg'] },
  { kind: 'duration', label: 'Duration', example: 'Planks, Yoga, Stretching', chips: ['Time'] },
  { kind: 'duration_weight', label: 'Duration & Weight', example: 'Weighted Plank, Wall Sit', chips: ['Kg', 'Time'], soon: true },
  { kind: 'distance_duration', label: 'Distance & Duration', example: 'Running, Cycling, Rowing', chips: ['Time', 'Km'], soon: true },
  { kind: 'weight_distance', label: 'Weight & Distance', example: 'Farmers Walk, Suitcase Carry', chips: ['Kg', 'Km'], soon: true },
];

/** Tipos que registram peso (kg) além de repetições. */
export const hasWeight = (kind: ExerciseKind | undefined) => kind !== 'reps' && kind !== 'duration';
/** Rótulo da coluna de peso no treino: KG, +KG (com peso extra) ou -KG (com ajuda). */
export const weightHeader = (kind: ExerciseKind | undefined, unit: string) => `${kind === 'weighted_bodyweight' ? '+' : kind === 'assisted_bodyweight' ? '-' : ''}${unit.toUpperCase()}`;
export const kindLabel = (kind: ExerciseKind) => EXERCISE_TYPES.find((t) => t.kind === kind)?.label ?? '';
