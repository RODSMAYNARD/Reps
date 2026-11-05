import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_EXERCISES, PROGRAMS } from './constants';
import { supabase } from './supabase';
import {
  ActiveEntry, ActiveSet, ActiveWorkout, Exercise, Measurement, Profile, Routine, RoutineExercise, SavedEntry, SetRow, Units, Workout,
} from './types';

export const DEFAULT_UNITS: Units = { weight: 'kg', distance: 'km', body: 'cm' };
const EMPTY_PROFILE: Profile = { username: '', displayName: '', bio: '', link: '', sex: null, birthYear: null, weightKg: null, units: DEFAULT_UNITS, theme: 'light', isPrivate: false, onboarded: false };

export const elapsedSec = (a: ActiveWorkout, now = Date.now()) => {
  const end = a.pausedAt ? new Date(a.pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(a.startedAt).getTime() - a.pausedMs) / 1000));
};

const newSet = (prev?: ActiveSet): ActiveSet => ({ type: 'normal', kg: null, reps: null, done: false, ...(prev ? {} : {}) });

type RestTimer = { endsAt: number; total: number } | null;

type Store = {
  ready: boolean; session: Session | null; error: string | null; toast: string | null;
  profile: Profile; exercises: Exercise[]; workouts: Workout[]; routines: Routine[]; measurements: Measurement[];
  active: ActiveWorkout | null; rest: RestTimer;
  // auth
  signIn: (e: string, p: string) => Promise<string | null>;
  signUp: (e: string, p: string) => Promise<string | null>;
  resetPassword: (e: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // perfil
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  // exercícios
  addExercise: (x: Omit<Exercise, 'id'>) => Promise<Exercise | null>;
  removeExercise: (id: string) => Promise<void>;
  // treino ativo
  startWorkout: (opts?: { routine?: Routine | null; entries?: SavedEntry[]; title?: string }) => void;
  setActiveTitle: (t: string) => void;
  addEntries: (ids: string[]) => void;
  removeEntry: (i: number) => void;
  replaceEntry: (i: number, exerciseId: string) => void;
  patchEntry: (i: number, patch: Partial<ActiveEntry>) => void;
  addSet: (i: number) => void;
  patchSet: (i: number, j: number, patch: Partial<ActiveSet>) => void;
  removeSet: (i: number, j: number) => void;
  toggleSet: (i: number, j: number) => void;
  pauseToggle: () => void;
  setElapsed: (sec: number) => void;
  discardActive: () => void;
  finishActive: (meta: { title: string; description: string; visibility: Workout['visibility']; date: string; durationSec: number }) => Promise<Workout | null>;
  // descanso
  startRest: (sec: number) => void;
  adjustRest: (delta: number) => void;
  skipRest: () => void;
  // treinos
  deleteWorkout: (id: string) => Promise<void>;
  // rotinas
  saveRoutine: (r: Omit<Routine, 'id'> & { id?: string }) => Promise<Routine | null>;
  deleteRoutine: (id: string) => Promise<void>;
  importProgram: (programId: string) => Promise<void>;
  // medidas
  saveMeasurement: (m: Omit<Measurement, 'id'> & { id?: string }) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  // feedback
  sendFeedback: (kind: 'feature' | 'report' | 'contact', body: string, ref?: string) => Promise<void>;
  showToast: (t: string) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [active, setActiveState] = useState<ActiveWorkout | null>(null);
  const [rest, setRest] = useState<RestTimer>(null);
  const userId = session?.user.id ?? null;
  const activeRef = useRef<ActiveWorkout | null>(null);
  const exRef = useRef<Exercise[]>([]);
  useEffect(() => { exRef.current = exercises; }, [exercises]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((c) => (c === t ? null : c)), 2500);
  }, []);
  const fail = useCallback((m: string) => { setError(m); showToast(m); }, [showToast]);

  const setActive = useCallback((fn: (a: ActiveWorkout) => ActiveWorkout | null) => {
    const next = activeRef.current ? fn(activeRef.current) : null;
    activeRef.current = next;
    setActiveState(next);
    if (userId) (next ? AsyncStorage.setItem(`reps:active:${userId}`, JSON.stringify(next)) : AsyncStorage.removeItem(`reps:active:${userId}`)).catch(() => {});
  }, [userId]);

  const load = useCallback(async (uid: string, email: string) => {
    let ex = await supabase.from('exercises').select('id,name,muscle,equipment,kind').order('created_at');
    if (ex.error) return setError(ex.error.message);
    if (ex.data.length === 0 && !(await AsyncStorage.getItem(`reps:seeded2:${uid}`))) {
      await supabase.from('exercises').insert(DEFAULT_EXERCISES);
      await AsyncStorage.setItem(`reps:seeded2:${uid}`, '1');
      ex = await supabase.from('exercises').select('id,name,muscle,equipment,kind').order('created_at');
      if (ex.error) return setError(ex.error.message);
    }
    setExercises(ex.data as Exercise[]);

    const pr = await supabase.from('profiles').select('*').maybeSingle();
    if (pr.data) {
      const p = pr.data;
      setProfile({ username: p.username, displayName: p.display_name, bio: p.bio, link: p.link, sex: p.sex, birthYear: p.birth_year, weightKg: p.weight_kg ? Number(p.weight_kg) : null, units: { ...DEFAULT_UNITS, ...p.units }, theme: p.theme, isPrivate: p.is_private, onboarded: p.onboarded });
    } else {
      const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 20);
      await supabase.from('profiles').insert({ username });
      setProfile({ ...EMPTY_PROFILE, username });
    }

    const wk = await supabase.from('workouts').select('id,performed_at,title,description,duration_sec,visibility,meta,workout_sets(exercise_id,position,reps,weight,set_type)').order('performed_at', { ascending: false });
    if (wk.error) return setError(wk.error.message);
    setWorkouts(wk.data.map((w: any) => {
      const sets = [...w.workout_sets].sort((a: any, b: any) => a.position - b.position);
      const order: string[] = [];
      const by = new Map<string, SetRow[]>();
      sets.forEach((s: any) => {
        if (!by.has(s.exercise_id)) { by.set(s.exercise_id, []); order.push(s.exercise_id); }
        by.get(s.exercise_id)!.push({ type: s.set_type, kg: Number(s.weight), reps: s.reps });
      });
      const meta = w.meta ?? {};
      return {
        id: w.id, date: w.performed_at, title: w.title, description: w.description, durationSec: w.duration_sec, visibility: w.visibility,
        entries: order.map((id) => ({ exerciseId: id, notes: meta.notes?.[id] ?? '', restSec: meta.rest?.[id] ?? 0, superset: meta.superset?.[id] ?? null, sets: by.get(id)! })),
      } as Workout;
    }));

    const rt = await supabase.from('routines').select('id,title,notes,exercises').order('created_at', { ascending: false });
    if (!rt.error) setRoutines(rt.data as Routine[]);
    const ms = await supabase.from('measurements').select('id,measured_on,values,photo_uri').order('measured_on', { ascending: false });
    if (!ms.error) setMeasurements(ms.data.map((m: any) => ({ id: m.id, date: m.measured_on, values: m.values, photoUri: m.photo_uri })));

    const raw = await AsyncStorage.getItem(`reps:active:${uid}`);
    activeRef.current = raw ? JSON.parse(raw) : null;
    setActiveState(activeRef.current);
    setError(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setExercises([]); setWorkouts([]); setRoutines([]); setMeasurements([]); setProfile(EMPTY_PROFILE); activeRef.current = null; setActiveState(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Carrega os dados do servidor quando o usuário entra (busca assíncrona).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userId) load(userId, session?.user.email ?? 'user').finally(() => setReady(true));
  }, [userId, session?.user.email, load]);

  const value = useMemo<Store>(() => ({
    ready, session, error, toast, profile, exercises, workouts, routines, measurements, active, rest, showToast,
    signIn: async (email, password) => (await supabase.auth.signInWithPassword({ email, password })).error?.message ?? null,
    signUp: async (email, password) => {
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      if (e) return e.message;
      return data.session ? null : 'Conta criada. Confirme o e-mail que enviamos e depois entre.';
    },
    resetPassword: async (email) => (await supabase.auth.resetPasswordForEmail(email)).error?.message ?? null,
    signOut: async () => void (await supabase.auth.signOut()),

    saveProfile: async (patch) => {
      const next = { ...profile, ...patch };
      setProfile(next);
      const { error: e } = await supabase.from('profiles').upsert({
        user_id: userId!, username: next.username, display_name: next.displayName, bio: next.bio, link: next.link, sex: next.sex, birth_year: next.birthYear,
        weight_kg: next.weightKg, units: next.units, theme: next.theme, is_private: next.isPrivate, onboarded: next.onboarded,
      });
      if (e) fail(e.message);
    },

    addExercise: async (x) => {
      const { data, error: e } = await supabase.from('exercises').insert({ name: x.name.trim(), muscle: x.muscle, equipment: x.equipment, kind: x.kind }).select('id,name,muscle,equipment,kind').single();
      if (e) { fail(e.message); return null; }
      setExercises((l) => [...l, data as Exercise]);
      return data as Exercise;
    },
    removeExercise: async (id) => {
      const { error: e } = await supabase.from('exercises').delete().eq('id', id);
      if (e) return fail(e.message);
      setExercises((l) => l.filter((x) => x.id !== id));
    },

    startWorkout: (opts) => {
      const src = opts?.entries ?? opts?.routine?.exercises ?? [];
      const entries: ActiveEntry[] = src.map((e) => ({
        exerciseId: e.exerciseId, notes: e.notes ?? '', restSec: e.restSec ?? 0, superset: e.superset ?? null,
        sets: (e.sets.length ? e.sets : ([{ type: 'normal', kg: null, reps: null }] as SetRow[])).map((s): ActiveSet => ({ ...s, done: false })),
      }));
      activeRef.current = { id: randomUUID(), title: opts?.title ?? opts?.routine?.title ?? 'Treino', startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0, entries, fromRoutineId: opts?.routine?.id ?? null };
      setActiveState(activeRef.current);
      if (userId) AsyncStorage.setItem(`reps:active:${userId}`, JSON.stringify(activeRef.current)).catch(() => {});
    },
    setActiveTitle: (t) => setActive((a) => ({ ...a, title: t })),
    addEntries: (ids) => setActive((a) => ({ ...a, entries: [...a.entries, ...ids.map((id): ActiveEntry => ({ exerciseId: id, notes: '', restSec: 0, sets: [newSet()] }))] })),
    removeEntry: (i) => setActive((a) => ({ ...a, entries: a.entries.filter((_, k) => k !== i) })),
    replaceEntry: (i, exerciseId) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, exerciseId } : e)) })),
    patchEntry: (i, patch) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, ...patch } : e)) })),
    addSet: (i) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: [...e.sets, { ...newSet(), kg: e.sets.at(-1)?.kg ?? null, reps: e.sets.at(-1)?.reps ?? null }] } : e)) })),
    patchSet: (i, j, patch) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: e.sets.map((s, n) => (n === j ? { ...s, ...patch } : s)) } : e)) })),
    removeSet: (i, j) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: e.sets.filter((_, n) => n !== j) } : e)) })),
    toggleSet: (i, j) => {
      const cur = activeRef.current?.entries[i];
      if (!cur) return;
      const willBeDone = !cur.sets[j].done;
      setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: e.sets.map((s, n) => (n === j ? { ...s, done: willBeDone } : s)) } : e)) }));
      if (willBeDone && cur.restSec > 0) setRest({ endsAt: Date.now() + cur.restSec * 1000, total: cur.restSec });
    },
    pauseToggle: () => setActive((a) => a.pausedAt
      ? { ...a, pausedMs: a.pausedMs + (Date.now() - new Date(a.pausedAt).getTime()), pausedAt: null }
      : { ...a, pausedAt: new Date().toISOString() }),
    setElapsed: (sec) => setActive((a) => ({ ...a, pausedMs: 0, pausedAt: a.pausedAt ? new Date().toISOString() : null, startedAt: new Date(Date.now() - sec * 1000).toISOString() })),
    discardActive: () => { setActive(() => null); setRest(null); },
    finishActive: async (meta) => {
      const a = activeRef.current;
      if (!a) return null;
      const entries: SavedEntry[] = a.entries
        .map((e) => ({ exerciseId: e.exerciseId, notes: e.notes, restSec: e.restSec, superset: e.superset ?? null, sets: e.sets.filter((s) => s.done).map(({ done: _d, ...s }) => s) }))
        .filter((e) => e.sets.length > 0);
      if (!entries.length) { fail('Conclua ao menos uma série para salvar o treino.'); return null; }
      const meta2 = {
        notes: Object.fromEntries(entries.filter((e) => e.notes).map((e) => [e.exerciseId, e.notes])),
        rest: Object.fromEntries(entries.filter((e) => e.restSec).map((e) => [e.exerciseId, e.restSec])),
        superset: Object.fromEntries(entries.filter((e) => e.superset != null).map((e) => [e.exerciseId, e.superset])),
      };
      const w = await supabase.from('workouts').insert({ id: a.id, performed_at: meta.date, title: meta.title || 'Treino', description: meta.description, duration_sec: meta.durationSec, visibility: meta.visibility, meta: meta2 });
      if (w.error) { fail(w.error.message); return null; }
      let pos = 0;
      const rows = entries.flatMap((e) => e.sets.map((s) => ({ workout_id: a.id, exercise_id: e.exerciseId, position: pos++, reps: s.reps ?? 0, weight: s.kg ?? 0, set_type: s.type })));
      const s = await supabase.from('workout_sets').insert(rows);
      if (s.error) { await supabase.from('workouts').delete().eq('id', a.id); fail(s.error.message); return null; }
      const saved: Workout = { id: a.id, date: meta.date, title: meta.title || 'Treino', description: meta.description, durationSec: meta.durationSec, visibility: meta.visibility, entries };
      setWorkouts((l) => [saved, ...l]);
      setActive(() => null);
      setRest(null);
      return saved;
    },

    startRest: (sec) => setRest({ endsAt: Date.now() + sec * 1000, total: sec }),
    adjustRest: (d) => setRest((r) => (r ? { endsAt: r.endsAt + d * 1000, total: Math.max(1, r.total + d) } : r)),
    skipRest: () => setRest(null),

    deleteWorkout: async (id) => {
      const { error: e } = await supabase.from('workouts').delete().eq('id', id);
      if (e) return fail(e.message);
      setWorkouts((l) => l.filter((w) => w.id !== id));
    },

    saveRoutine: async (r) => {
      const row = { title: r.title.trim() || 'Rotina', notes: r.notes, exercises: r.exercises as RoutineExercise[] };
      const q = r.id ? supabase.from('routines').update(row).eq('id', r.id) : supabase.from('routines').insert(row);
      const { data, error: e } = await q.select('id,title,notes,exercises').single();
      if (e) { fail(e.message); return null; }
      setRoutines((l) => (r.id ? l.map((x) => (x.id === r.id ? (data as Routine) : x)) : [data as Routine, ...l]));
      return data as Routine;
    },
    deleteRoutine: async (id) => {
      const { error: e } = await supabase.from('routines').delete().eq('id', id);
      if (e) return fail(e.message);
      setRoutines((l) => l.filter((x) => x.id !== id));
    },
    importProgram: async (programId) => {
      const p = PROGRAMS.find((x) => x.id === programId);
      if (!p) return;
      for (const r of p.routines) {
        const exs: RoutineExercise[] = r.exercises.flatMap((name) => {
          const ex = exRef.current.find((x) => x.name === name);
          return ex ? [{ exerciseId: ex.id, notes: '', restSec: 90, sets: [{ type: 'normal', kg: null, reps: 10 }, { type: 'normal', kg: null, reps: 10 }, { type: 'normal', kg: null, reps: 10 }] } as RoutineExercise] : [];
        });
        const { data } = await supabase.from('routines').insert({ title: r.title, notes: r.notes, exercises: exs }).select('id,title,notes,exercises').single();
        if (data) setRoutines((l) => [data as Routine, ...l]);
      }
    },

    saveMeasurement: async (m) => {
      const row = { measured_on: m.date, values: m.values, photo_uri: m.photoUri };
      const q = m.id ? supabase.from('measurements').update(row).eq('id', m.id) : supabase.from('measurements').insert(row);
      const { data, error: e } = await q.select('id,measured_on,values,photo_uri').single();
      if (e) return fail(e.message);
      const mm: Measurement = { id: data.id, date: data.measured_on, values: data.values, photoUri: data.photo_uri };
      setMeasurements((l) => [mm, ...l.filter((x) => x.id !== mm.id)].sort((a, b) => b.date.localeCompare(a.date)));
    },
    deleteMeasurement: async (id) => {
      const { error: e } = await supabase.from('measurements').delete().eq('id', id);
      if (e) return fail(e.message);
      setMeasurements((l) => l.filter((x) => x.id !== id));
    },

    sendFeedback: async (kind, body, ref) => {
      const { error: e } = await supabase.from('feedback').insert({ kind, body, ref });
      if (e) fail(e.message);
    },
  }), [ready, session, error, toast, profile, exercises, workouts, routines, measurements, active, rest, userId, setActive, fail, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}

export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
