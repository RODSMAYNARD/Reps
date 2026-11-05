export type SetType = 'warmup' | 'normal' | 'failure' | 'drop';
export type ExerciseKind = 'weight_reps' | 'reps' | 'duration';
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

export type Exercise = { id: string; name: string; muscle: string; equipment: string; kind: ExerciseKind; catalogId?: string | null };

export type SetRow = { type: SetType; kg: number | null; reps: number | null; seconds?: number | null };
export type ActiveSet = SetRow & { done: boolean };
export type ActiveEntry = { uid?: string; hidden?: boolean; exerciseId: string; notes: string; restSec: number; sets: ActiveSet[]; superset?: number | null };
export type ActiveWorkout = { id: string; title: string; startedAt: string; pausedAt: string | null; pausedMs: number; entries: ActiveEntry[]; fromRoutineId?: string | null };

export type SavedEntry = { exerciseId: string; notes: string; restSec: number; sets: SetRow[]; superset?: number | null };
export type Workout = {
  id: string;
  date: string;
  title: string;
  description: string;
  durationSec: number;
  visibility: 'everyone' | 'followers' | 'private';
  entries: SavedEntry[];
};

export type RoutineExercise = { exerciseId: string; notes: string; restSec: number; sets: SetRow[]; superset?: number | null };
export type Routine = { id: string; title: string; notes: string; exercises: RoutineExercise[] };

export type Measurement = { id: string; date: string; values: Record<string, number>; photoUri: string | null };
