import { DEFAULT_PLATE_SETS, type PlateSet } from './plates';
export type SetType = 'warmup' | 'normal' | 'failure' | 'drop';
/** `duration` (antigo) guarda os segundos em `reps`; os tipos com distância/tempo novos usam `seconds` e `distM`. */
export type ExerciseKind = 'weight_reps' | 'reps' | 'duration' | 'weighted_bodyweight' | 'assisted_bodyweight' | 'duration_weight' | 'distance_duration' | 'weight_distance';
export type Units = { weight: 'kg' | 'lbs'; distance: 'km' | 'mi'; body: 'cm' | 'in' };

export type Profile = {
  username: string;
  displayName: string;
  bio: string;
  link: string;
  sex: 'male' | 'female' | null;
  birthYear: number | null;
  weightKg: number | null;
  units: Units;
  theme: 'light' | 'dark' | 'system';
  isPrivate: boolean;
  onboarded: boolean;
};

/** `target`: músculo específico (mesmos nomes do catálogo: Lats, Traps...); `secondary`: outros músculos trabalhados; `assetUri`: imagem (só no aparelho). */
export type Exercise = { id: string; name: string; muscle: string; equipment: string; kind: ExerciseKind; catalogId?: string | null; target?: string | null; secondary?: string[]; assetUri?: string | null };

export type SetRow = { type: SetType; kg: number | null; reps: number | null; seconds?: number | null; /** distância em metros */ distM?: number | null };
/** `typed`: o usuário digitou kg/reps (ou tocou em PREVIOUS); ao finalizar, séries digitadas e sem ✓ passam a valer, como no Hevy. */
export type ActiveSet = SetRow & { done: boolean; typed?: boolean };
/** Tipo da nota do exercício: do treino (vai no post), fixada no exercício ou fixada na rotina (as fixadas não vão no post). */
export type NoteKind = 'workout' | 'exercise' | 'routine';
/** Uma nota do exercício (pode haver várias): texto e tipo. */
export type EntryNote = { id: string; text: string; kind: NoteKind };
export type ActiveEntry = { uid?: string; hidden?: boolean; unit?: Units['weight']; noteKind?: NoteKind; noteList?: EntryNote[]; swappedFrom?: string; madeMain?: boolean; exerciseId: string; notes: string; restSec: number; sets: ActiveSet[]; superset?: number | null };
export type ActiveWorkout = { id: string; title: string; startedAt: string; pausedAt: string | null; pausedMs: number; entries: ActiveEntry[]; fromRoutineId?: string | null; fromTrainer?: string | null; dateAt?: string | null };

export type SavedEntry = { unit?: Units['weight']; exerciseId: string; notes: string; restSec: number; sets: SetRow[]; superset?: number | null };
export type Workout = {
  id: string;
  date: string;
  title: string;
  description: string;
  durationSec: number;
  visibility: 'everyone' | 'followers' | 'private';
  entries: SavedEntry[];
  routineId?: string | null;
  location?: string | null;
  fromTrainer?: boolean;
  /** Salvo sem internet, ainda na fila para subir (só no aparelho). */
  pending?: boolean;
};

export type RoutineExercise = { unit?: Units['weight']; exerciseId: string; notes: string; restSec: number; sets: SetRow[]; superset?: number | null };
export type Routine = { id: string; title: string; notes: string; exercises: RoutineExercise[] };

/** `photoUri` = o que a tela mostra (URL assinada do Storage ou arquivo local recém-escolhido); `photoPath` = caminho no bucket privado `progress-photos`. */
export type Measurement = { id: string; date: string; values: Record<string, number>; photoUri: string | null; photoPath?: string | null };

export type WarmupRow = { pct: number; reps: number };
export type SoundVolume = 'high' | 'normal' | 'low' | 'off';
export type TimerSound = 'default' | 'alarm' | 'futuristic' | 'ting' | 'boxing' | 'iron' | 'marimba' | 'liftoff';
export type WorkoutPrefs = {
  timerSound: TimerSound; timerVolume: SoundVolume; checkVolume: SoundVolume; prVolume: SoundVolume;
  sounds: boolean; defaultRestSec: number; prevMode: 'any' | 'routine';
  warmupCalc: boolean; warmupFormula: WarmupRow[]; plateRounding: number; dumbbellRounding: number;
  keepAwake: boolean; plateCalc: boolean; plateSets: Record<Units['weight'], PlateSet>; rpe: boolean; smartSuperset: boolean; inlineTimer: boolean; livePR: boolean;
  /** Lembretes locais (Settings > Reminders): dias (0 = domingo) e horário, aviso após 3 dias sem treinar e meta de treinos por semana (0 = desligada). */
  remind: boolean; remindDays: number[]; remindHour: number; remindMin: number; nudge: boolean; weeklyGoal: number;
};
export const DEFAULT_WARMUP: WarmupRow[] = [{ pct: 40, reps: 5 }, { pct: 60, reps: 5 }, { pct: 80, reps: 3 }];
export const DEFAULT_WPREFS: WorkoutPrefs = {
  timerSound: 'default', timerVolume: 'high', checkVolume: 'off', prVolume: 'high',
  sounds: true, defaultRestSec: 90, prevMode: 'any', warmupCalc: false, warmupFormula: DEFAULT_WARMUP, plateRounding: 5, dumbbellRounding: 1,
  keepAwake: false, plateCalc: true, plateSets: DEFAULT_PLATE_SETS, rpe: false, smartSuperset: false, inlineTimer: true, livePR: true,
  remind: false, remindDays: [1, 3, 5], remindHour: 18, remindMin: 0, nudge: false, weeklyGoal: 0,
};

export type TrainerLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainerSplit = 'pplul' | 'fullbody' | 'ul' | 'ppl';
export type TrainerGoal = 'hypertrophy' | 'strength' | 'fatloss';
export type TrainerSettings = {
  level: TrainerLevel; preset: string; equipment: string[]; focus: string | null; duration: 40 | 60 | 80;
  rest: 'short' | 'medium' | 'long'; variety: 'balanced' | 'consistent' | 'varied'; deload: boolean;
  cardio: boolean; cardioWhere: 'start' | 'end'; excluded: string[]; injuries: string[];
  split: TrainerSplit; goal: TrainerGoal; frequency: number;
};
export type TrainerExercise = { exerciseId: string; sets: number; repMin: number; repMax: number; restSec: number; kind: ExerciseKind };
export type TrainerWorkout = { uid: string; kind: string; title: string; notes: string; exercises: TrainerExercise[] };
export type TrainerProgram = {
  id: string; name: string; startedAt: string; cycle: number; seed: number; completed: number;
  settings: TrainerSettings; workouts: TrainerWorkout[]; nextUid: string;
};
