import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { Exercise, Workout, WorkoutSet } from './types';

const DEFAULT_EXERCISES = [
  { name: 'Supino reto', muscle: 'Peito' },
  { name: 'Agachamento', muscle: 'Pernas' },
  { name: 'Levantamento terra', muscle: 'Costas' },
  { name: 'Desenvolvimento', muscle: 'Ombros' },
  { name: 'Remada curvada', muscle: 'Costas' },
  { name: 'Rosca direta', muscle: 'Bíceps' },
];

type Store = {
  ready: boolean;
  session: Session | null;
  exercises: Exercise[];
  workouts: Workout[];
  draft: Workout | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  addExercise: (name: string, muscle: string) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
  addSet: (exerciseId: string, set: WorkoutSet) => void;
  removeSet: (exerciseId: string, index: number) => void;
  finishWorkout: () => Promise<void>;
  discardDraft: () => void;
  deleteWorkout: (id: string) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [draft, setDraftState] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;
  const draftKey = userId ? `reps:draft:${userId}` : null;

  const setDraft = useCallback(
    (d: Workout | null) => {
      setDraftState(d);
      if (draftKey) (d ? AsyncStorage.setItem(draftKey, JSON.stringify(d)) : AsyncStorage.removeItem(draftKey)).catch(() => {});
    },
    [draftKey],
  );

  const load = useCallback(async (uid: string) => {
    const seedKey = `reps:seeded:${uid}`;
    let ex = await supabase.from('exercises').select('id,name,muscle').order('created_at');
    if (ex.error) return setError(ex.error.message);
    if (ex.data.length === 0 && !(await AsyncStorage.getItem(seedKey))) {
      await supabase.from('exercises').insert(DEFAULT_EXERCISES);
      await AsyncStorage.setItem(seedKey, '1');
      ex = await supabase.from('exercises').select('id,name,muscle').order('created_at');
      if (ex.error) return setError(ex.error.message);
    }
    setExercises(ex.data as Exercise[]);

    const wk = await supabase
      .from('workouts')
      .select('id,performed_at,workout_sets(exercise_id,position,reps,weight)')
      .order('performed_at', { ascending: false });
    if (wk.error) return setError(wk.error.message);
    setWorkouts(
      wk.data.map((w) => {
        const byEx = new Map<string, WorkoutSet[]>();
        [...w.workout_sets]
          .sort((a, b) => a.position - b.position)
          .forEach((s) => byEx.set(s.exercise_id, [...(byEx.get(s.exercise_id) ?? []), { reps: s.reps, weight: Number(s.weight) }]));
        return { id: w.id, date: w.performed_at, entries: [...byEx].map(([exerciseId, sets]) => ({ exerciseId, sets })) };
      }),
    );

    const raw = await AsyncStorage.getItem(`reps:draft:${uid}`);
    setDraftState(raw ? JSON.parse(raw) : null);
    setError(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setExercises([]);
        setWorkouts([]);
        setDraftState(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Carrega os dados do servidor quando o usuário entra (busca assíncrona).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userId) load(userId).finally(() => setReady(true));
  }, [userId, load]);

  const value = useMemo<Store>(
    () => ({
      ready,
      session,
      exercises,
      workouts,
      draft,
      error,
      signIn: async (email, password) => (await supabase.auth.signInWithPassword({ email, password })).error?.message ?? null,
      signUp: async (email, password) => {
        const { data, error: e } = await supabase.auth.signUp({ email, password });
        if (e) return e.message;
        return data.session ? null : 'Conta criada. Confirme o e-mail enviado para você e depois entre.';
      },
      signOut: async () => void (await supabase.auth.signOut()),
      addExercise: async (name, muscle) => {
        const { data, error: e } = await supabase.from('exercises').insert({ name: name.trim(), muscle: muscle.trim() }).select('id,name,muscle').single();
        if (e) return setError(e.message);
        setExercises((x) => [...x, data as Exercise]);
      },
      removeExercise: async (id) => {
        const { error: e } = await supabase.from('exercises').delete().eq('id', id);
        if (e) return setError(e.message);
        if (userId) await load(userId);
      },
      addSet: (exerciseId, set) => {
        const d = draft ?? { id: randomUUID(), date: new Date().toISOString(), entries: [] };
        const has = d.entries.some((e) => e.exerciseId === exerciseId);
        const entries = has
          ? d.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, set] } : e))
          : [...d.entries, { exerciseId, sets: [set] }];
        setDraft({ ...d, entries });
      },
      removeSet: (exerciseId, index) => {
        if (!draft) return;
        const entries = draft.entries
          .map((e) => (e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((_, i) => i !== index) } : e))
          .filter((e) => e.sets.length > 0);
        setDraft(entries.length ? { ...draft, entries } : null);
      },
      finishWorkout: async () => {
        if (!draft) return;
        const w = await supabase.from('workouts').insert({ id: draft.id, performed_at: draft.date });
        if (w.error) return setError(w.error.message);
        const rows = draft.entries.flatMap((e) =>
          e.sets.map((s, position) => ({ workout_id: draft.id, exercise_id: e.exerciseId, position, reps: s.reps, weight: s.weight })),
        );
        const s = await supabase.from('workout_sets').insert(rows);
        if (s.error) {
          await supabase.from('workouts').delete().eq('id', draft.id);
          return setError(s.error.message);
        }
        setWorkouts((x) => [draft, ...x]);
        setDraft(null);
      },
      discardDraft: () => setDraft(null),
      deleteWorkout: async (id) => {
        const { error: e } = await supabase.from('workouts').delete().eq('id', id);
        if (e) return setError(e.message);
        setWorkouts((x) => x.filter((w) => w.id !== id));
      },
    }),
    [ready, session, exercises, workouts, draft, error, userId, load, setDraft],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}
