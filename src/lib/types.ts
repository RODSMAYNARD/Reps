export type Exercise = { id: string; name: string; muscle: string };
export type WorkoutSet = { reps: number; weight: number };
export type WorkoutEntry = { exerciseId: string; sets: WorkoutSet[] };
export type Workout = { id: string; date: string; entries: WorkoutEntry[] };
