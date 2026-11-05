import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Exercise, Workout, WorkoutSet } from './types';

const KEY = 'reps:v1';

type Data = { exercises: Exercise[]; workouts: Workout[]; draft: Workout | null };

const DEFAULT_EXERCISES: Exercise[] = [
  { id: 'ex-supino', name: 'Supino reto', muscle: 'Peito' },
  { id: 'ex-agacho', name: 'Agachamento', muscle: 'Pernas' },
  { id: 'ex-terra', name: 'Levantamento terra', muscle: 'Costas' },
  { id: 'ex-desenv', name: 'Desenvolvimento', muscle: 'Ombros' },
  { id: 'ex-remada', name: 'Remada curvada', muscle: 'Costas' },
  { id: 'ex-rosca', name: 'Rosca direta', muscle: 'Bíceps' },
];

const EMPTY: Data = { exercises: DEFAULT_EXERCISES, workouts: [], draft: null };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

type Store = Data & {
  loaded: boolean;
  addExercise: (name: string, muscle: string) => void;
  removeExercise: (id: string) => void;
  addSet: (exerciseId: string, set: WorkoutSet) => void;
  removeSet: (exerciseId: string, index: number) => void;
  finishWorkout: () => void;
  discardDraft: () => void;
  deleteWorkout: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setData({ ...EMPTY, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...data,
      loaded,
      addExercise: (name, muscle) =>
        update((d) => ({ ...d, exercises: [...d.exercises, { id: uid(), name: name.trim(), muscle: muscle.trim() }] })),
      removeExercise: (id) => update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) })),
      addSet: (exerciseId, set) =>
        update((d) => {
          const draft = d.draft ?? { id: uid(), date: new Date().toISOString(), entries: [] };
          const has = draft.entries.some((e) => e.exerciseId === exerciseId);
          const entries = has
            ? draft.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, set] } : e))
            : [...draft.entries, { exerciseId, sets: [set] }];
          return { ...d, draft: { ...draft, entries } };
        }),
      removeSet: (exerciseId, index) =>
        update((d) => {
          if (!d.draft) return d;
          const entries = d.draft.entries
            .map((e) => (e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((_, i) => i !== index) } : e))
            .filter((e) => e.sets.length > 0);
          return { ...d, draft: entries.length ? { ...d.draft, entries } : null };
        }),
      finishWorkout: () =>
        update((d) => (d.draft ? { ...d, workouts: [d.draft, ...d.workouts], draft: null } : d)),
      discardDraft: () => update((d) => ({ ...d, draft: null })),
      deleteWorkout: (id) => update((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) })),
    }),
    [data, loaded, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}
