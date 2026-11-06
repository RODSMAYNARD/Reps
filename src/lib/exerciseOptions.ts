import { ExerciseKind } from './types';

/** Opções do fluxo "Create Exercise". `value` é o que fica salvo (mesmos nomes do catálogo). */
export const EQUIPMENT_OPTIONS: { label: string; value: string; icon: string }[] = [
  { label: 'None', value: 'Body weight', icon: 'body-outline' },
  { label: 'Barbell', value: 'Barbell', icon: 'remove-outline' },
  { label: 'Dumbbell', value: 'Dumbbell', icon: 'barbell-outline' },
  { label: 'Kettlebell', value: 'Kettlebell', icon: 'basketball-outline' },
  { label: 'Machine', value: 'Machine', icon: 'grid-outline' },
  { label: 'Cable', value: 'Cable', icon: 'git-merge-outline' },
  { label: 'Plate', value: 'Plate', icon: 'disc-outline' },
  { label: 'Resistance Band', value: 'Band', icon: 'reorder-two-outline' },
  { label: 'Suspension Band', value: 'Suspension band', icon: 'git-network-outline' },
  { label: 'Other', value: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

/** `muscle` = grupo usado nas listas/filtros/Trainer; `target` = músculo específico do catálogo (para os filtros finos). */
export const MUSCLE_OPTIONS: { label: string; muscle: string; target?: string; icon: string }[] = [
  { label: 'Abdominals', muscle: 'Abs', icon: 'body-outline' },
  { label: 'Abductors', muscle: 'Glutes', target: 'Abductors', icon: 'resize-outline' },
  { label: 'Adductors', muscle: 'Glutes', target: 'Adductors', icon: 'contract-outline' },
  { label: 'Biceps', muscle: 'Biceps', icon: 'barbell-outline' },
  { label: 'Calves', muscle: 'Calves', icon: 'walk-outline' },
  { label: 'Cardio', muscle: 'Cardio', icon: 'pulse-outline' },
  { label: 'Chest', muscle: 'Chest', icon: 'heart-outline' },
  { label: 'Forearms', muscle: 'Forearms', icon: 'hand-left-outline' },
  { label: 'Full Body', muscle: 'Full body', icon: 'accessibility-outline' },
  { label: 'Glutes', muscle: 'Glutes', icon: 'ellipse-outline' },
  { label: 'Hamstrings', muscle: 'Hamstrings', icon: 'footsteps-outline' },
  { label: 'Lats', muscle: 'Back', target: 'Lats', icon: 'triangle-outline' },
  { label: 'Lower Back', muscle: 'Back', target: 'Spine', icon: 'swap-vertical-outline' },
  { label: 'Neck', muscle: 'Shoulders', target: 'Levator scapulae', icon: 'person-outline' },
  { label: 'Quadriceps', muscle: 'Quads', icon: 'fitness-outline' },
  { label: 'Shoulders', muscle: 'Shoulders', icon: 'shirt-outline' },
  { label: 'Traps', muscle: 'Back', target: 'Traps', icon: 'chevron-up-outline' },
  { label: 'Triceps', muscle: 'Triceps', icon: 'barbell-outline' },
  { label: 'Upper Back', muscle: 'Back', target: 'Upper back', icon: 'layers-outline' },
  { label: 'Other', muscle: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
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
