import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { randomUUID } from './uuid';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CAT_BY_ID, CATALOG, catToExercise } from './catalog';
import { track } from './analytics';
import { reportError } from './monitoring';
import { noteFields, notesOf, workoutText } from './notes';
import { playSound } from './sounds';
import { prFlags, records } from './stats';
import { CYCLE_WEEKS, generateProgram, suggestSets } from './trainer';
import { supabase } from './supabase';
import {
  ActiveEntry, ActiveSet, ActiveWorkout, DEFAULT_WPREFS, EntryNote, NoteKind, Exercise, Measurement, Profile, Routine, RoutineExercise, SavedEntry, SetRow, TrainerProgram, Units, Workout, WorkoutPrefs,
} from './types';

export const DEFAULT_UNITS: Units = { weight: 'kg', distance: 'km', body: 'cm' };
const EMPTY_PROFILE: Profile = { username: '', displayName: '', bio: '', link: '', sex: null, birthYear: null, weightKg: null, units: DEFAULT_UNITS, theme: 'light', isPrivate: false, onboarded: false };

export const elapsedSec = (a: ActiveWorkout, now = Date.now()) => {
  const end = a.pausedAt ? new Date(a.pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(a.startedAt).getTime() - a.pausedMs) / 1000));
};

const byPosition = <T extends { position: number }>(rows: T[] | null | undefined) => [...(rows ?? [])].sort((a, b) => a.position - b.position);

/** Grava treino + exercícios + séries numa transação (função `save_workout` no banco). `meta` continua sendo gravado para o app antigo ainda instalado. */
const saveWorkoutRpc = (w: { id: string; date: string; title: string; description: string; durationSec: number; visibility: Workout['visibility']; routineId: string | null; location: string | null; fromTrainer: boolean }, entries: SavedEntry[]) =>
  supabase.rpc('save_workout', {
    p_workout: {
      id: w.id, performed_at: w.date, title: w.title, description: w.description, duration_sec: w.durationSec, visibility: w.visibility,
      routine_id: w.routineId, location: w.location, from_trainer: w.fromTrainer,
      meta: {
        notes: Object.fromEntries(entries.filter((e) => e.notes).map((e) => [e.exerciseId, e.notes])),
        rest: Object.fromEntries(entries.filter((e) => e.restSec).map((e) => [e.exerciseId, e.restSec])),
        superset: Object.fromEntries(entries.filter((e) => e.superset != null).map((e) => [e.exerciseId, e.superset])),
        routineId: w.routineId, location: w.location, trainer: w.fromTrainer || undefined,
      },
    },
    p_entries: entries.map((e) => ({
      exercise_id: e.exerciseId, notes: e.notes, rest_sec: e.restSec, superset: e.superset ?? null,
      sets: e.sets.map((s) => ({ set_type: s.type, weight: s.kg ?? 0, reps: s.reps ?? 0 })),
    })),
  });

const newSet = (prev?: ActiveSet): ActiveSet => ({ type: 'normal', kg: null, reps: null, done: false, ...(prev ? {} : {}) });

type RestTimer = { endsAt: number; total: number } | null;

type Store = {
  ready: boolean; session: Session | null; error: string | null; toast: string | null;
  profile: Profile; exercises: Exercise[]; workouts: Workout[]; routines: Routine[]; measurements: Measurement[];
  active: ActiveWorkout | null; rest: RestTimer;
  allExercises: Exercise[];
  ensureExercises: (ids: string[]) => Promise<string[]>;
  findExercise: (id: string) => Exercise | undefined;
  realExerciseId: (id: string) => string;
  wprefs: WorkoutPrefs;
  setWprefs: (patch: Partial<WorkoutPrefs>) => void;
  previousSets: (exerciseId: string) => SetRow[];
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
  startWorkout: (opts?: { routine?: Routine | null; entries?: SavedEntry[]; title?: string; trainerUid?: string }) => void;
  trainer: TrainerProgram | null;
  saveTrainer: (p: TrainerProgram | null) => void;
  startTrainerWorkout: (uid: string) => void;
  skipTrainerWorkout: (uid: string) => void;
  setActiveTitle: (t: string) => void;
  addEntries: (ids: string[]) => void;
  removeEntry: (i: number) => void;
  moveEntry: (from: number, to: number) => void;
  /** Notas do exercício no treino ativo: texto, tipo (treino / fixada no exercício / fixada na rotina) e apagar. */
  /** Notas fixadas do exercício (tela do exercício > How to). */
  pinnedNotes: (exerciseId: string) => string[];
  setPinnedNotes: (exerciseId: string, texts: string[]) => void;
  addNote: (i: number) => string;
  setNote: (i: number, id: string, text: string) => void;
  setNoteKind: (i: number, id: string, kind: NoteKind) => void;
  deleteNote: (i: number, id: string) => void;
  replaceEntry: (i: number, exerciseId: string) => void;
  /** Troca o exercício só neste treino (guarda o original em `swappedFrom`; trocar de volta para o original limpa). */
  swapEntry: (i: number, exerciseId: string) => void;
  patchEntry: (i: number, patch: Partial<ActiveEntry>) => void;
  addSet: (i: number) => void;
  patchSet: (i: number, j: number, patch: Partial<ActiveSet>) => void;
  removeSet: (i: number, j: number) => void;
  toggleSet: (i: number, j: number) => void;
  pauseToggle: () => void;
  setElapsed: (sec: number) => void;
  /** Dia e hora em que o treino foi feito (a duração não muda). `null` volta a acompanhar o início do cronômetro. */
  setStartTime: (iso: string | null) => void;
  /** Ao finalizar: séries com kg/reps digitados e sem ✓ passam a contar como feitas (como no Hevy). */
  completeTypedSets: () => void;
  discardActive: () => void;
  finishActive: (meta: { title: string; description: string; visibility: Workout['visibility']; date: string; durationSec: number; location?: string | null }) => Promise<Workout | null>;
  // descanso
  startRest: (sec: number) => void;
  adjustRest: (delta: number) => void;
  skipRest: () => void;
  // treinos
  deleteWorkout: (id: string) => Promise<void>;
  updateWorkout: (id: string, patch: { title: string; description: string; date: string; visibility: Workout['visibility']; location: string | null; durationSec: number; entries: SavedEntry[] }) => Promise<boolean>;
  // rotinas
  saveRoutine: (r: Omit<Routine, 'id'> & { id?: string }) => Promise<Routine | null>;
  deleteRoutine: (id: string) => Promise<void>;
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
  /** Notas fixadas (só no aparelho): listas por exercício e por rotina+exercício. Chave = id canônico (catálogo = cat:<id>). */
  const pinnedRef = useRef<{ exercise: Record<string, string[]>; routine: Record<string, string[]> }>({ exercise: {}, routine: {} });
  const pinKey = useCallback((exerciseId: string) => {
    const ex = exRef.current.find((e) => e.id === exerciseId);
    return ex?.catalogId ? `cat:${ex.catalogId}` : exerciseId;
  }, []);
  const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : typeof v === 'string' && v ? [v] : []);
  const readPins = useCallback((kind: 'exercise' | 'routine', exerciseId: string, routineId?: string | null): string[] =>
    asList(kind === 'exercise' ? pinnedRef.current.exercise[pinKey(exerciseId)] : routineId ? pinnedRef.current.routine[`${routineId}:${pinKey(exerciseId)}`] : undefined), [pinKey]);
  const writePins = useCallback((kind: 'exercise' | 'routine', exerciseId: string, routineId: string | null | undefined, texts: string[]) => {
    const map = kind === 'exercise' ? pinnedRef.current.exercise : pinnedRef.current.routine;
    const key = kind === 'exercise' ? pinKey(exerciseId) : routineId ? `${routineId}:${pinKey(exerciseId)}` : null;
    if (!key) return;
    if (texts.length) map[key] = texts; else delete map[key];
    if (userId) AsyncStorage.setItem(`reps:pinned:${userId}`, JSON.stringify(pinnedRef.current)).catch(() => {});
  }, [userId, pinKey]);
  /** Regrava as notas fixadas do exercício a partir da lista atual das notas dele. */
  const syncPins = useCallback((e: ActiveEntry, list: EntryNote[], routineId?: string | null) => {
    writePins('exercise', e.exerciseId, routineId, list.filter((n) => n.kind === 'exercise' && n.text.trim()).map((n) => n.text));
    if (routineId) writePins('routine', e.exerciseId, routineId, list.filter((n) => n.kind === 'routine' && n.text.trim()).map((n) => n.text));
  }, [writePins]);
  /** Notas iniciais de um exercício ao começar o treino: da rotina (fixadas), fixadas do exercício e a do treino copiado. */
  const startNotes = useCallback((exerciseId: string, saved: string, opts?: { routine?: Routine | null; entries?: SavedEntry[] }): EntryNote[] => {
    const rid = opts?.routine?.id;
    const out: EntryNote[] = [];
    if (rid) {
      const pins = readPins('routine', exerciseId, rid);
      (pins.length ? pins : !opts?.entries && saved ? [saved] : []).forEach((text) => out.push({ id: randomUUID(), text, kind: 'routine' }));
    }
    readPins('exercise', exerciseId).forEach((text) => out.push({ id: randomUUID(), text, kind: 'exercise' }));
    if ((!rid || opts?.entries) && saved) out.push({ id: randomUUID(), text: saved, kind: 'workout' });
    return out;
  }, [readPins]);
  const [trainer, setTrainerState] = useState<TrainerProgram | null>(null);
  const trainerRef = useRef<TrainerProgram | null>(null);
  const [wprefs, setWprefsState] = useState<WorkoutPrefs>(DEFAULT_WPREFS);
  const prefsRef = useRef<WorkoutPrefs>(DEFAULT_WPREFS);
  const wkRef = useRef<Workout[]>([]);
  useEffect(() => { wkRef.current = workouts; }, [workouts]);
  // Sets da última vez que o exercício foi feito (aceita id real ou cat:<id>)
  const lastSetsOf = useCallback((exerciseId: string, routineId?: string | null): SetRow[] => {
    const real = exerciseId.startsWith('cat:') ? exRef.current.find((e) => e.catalogId === exerciseId.slice(4))?.id ?? exerciseId : exerciseId;
    const sameRoutine = prefsRef.current.prevMode === 'routine' && !!routineId;
    for (const w of wkRef.current) {
      if (sameRoutine && w.routineId !== routineId) continue;
      const en = w.entries.find((e) => e.exerciseId === real);
      if (en && en.sets.length) return en.sets;
    }
    return [];
  }, []);

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
    const ex = await supabase.from('exercises').select('id,name,muscle,equipment,kind,catalog_id,target,secondary_muscles').order('created_at');
    if (ex.error) return setError(ex.error.message);
    const assets = JSON.parse((await AsyncStorage.getItem('reps:exassets').catch(() => null)) ?? '{}') as Record<string, string>;
    setExercises(ex.data.map((r: any) => { const c = r.catalog_id ? CAT_BY_ID.get(r.catalog_id) : undefined; return { id: r.id, name: c?.n ?? r.name, muscle: c?.m ?? r.muscle, equipment: c?.e ?? r.equipment, kind: (c?.k ?? r.kind) as Exercise['kind'], catalogId: r.catalog_id, target: r.target ?? null, secondary: r.secondary_muscles ?? [], assetUri: assets[r.id] ?? null }; }));

    const fallbackName = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'athlete';
    const pr = await supabase.from('profiles').select('*').maybeSingle();
    if (pr.data) {
      const p = pr.data;
      setProfile({ username: p.username || fallbackName, displayName: p.display_name, bio: p.bio, link: p.link, sex: p.sex, birthYear: p.birth_year, weightKg: p.weight_kg ? Number(p.weight_kg) : null, units: { ...DEFAULT_UNITS, ...p.units }, theme: p.theme, isPrivate: p.is_private, onboarded: p.onboarded });
    } else {
      await supabase.from('profiles').upsert({ user_id: uid, username: fallbackName });
      setProfile({ ...EMPTY_PROFILE, username: fallbackName });
    }

    const wk = await supabase.from('workouts')
      .select('id,performed_at,title,description,duration_sec,visibility,routine_id,location,from_trainer,workout_exercises(exercise_id,position,notes,rest_sec,superset,workout_sets(position,reps,weight,set_type))')
      .order('performed_at', { ascending: false });
    if (wk.error) return setError(wk.error.message);
    setWorkouts(wk.data.map((w: any) => ({
      id: w.id, date: w.performed_at, title: w.title, description: w.description, durationSec: w.duration_sec, visibility: w.visibility,
      routineId: w.routine_id, location: w.location, fromTrainer: w.from_trainer,
      entries: byPosition(w.workout_exercises).map((e: any) => ({
        exerciseId: e.exercise_id, notes: e.notes, restSec: e.rest_sec, superset: e.superset,
        sets: byPosition(e.workout_sets).map((s: any): SetRow => ({ type: s.set_type, kg: Number(s.weight), reps: s.reps })),
      })),
    } as Workout)));

    const rt = await supabase.from('routines')
      .select('id,title,notes,routine_exercises(exercise_id,position,notes,rest_sec,superset,routine_sets(position,set_type,weight,reps))')
      .order('created_at', { ascending: false });
    if (!rt.error) setRoutines(rt.data.map((r: any): Routine => ({
      id: r.id, title: r.title, notes: r.notes,
      exercises: byPosition(r.routine_exercises).map((e: any) => ({
        exerciseId: e.exercise_id, notes: e.notes, restSec: e.rest_sec, superset: e.superset,
        sets: byPosition(e.routine_sets).map((s: any): SetRow => ({ type: s.set_type, kg: s.weight == null ? null : Number(s.weight), reps: s.reps })),
      })),
    })));
    const ms = await supabase.from('measurements').select('id,measured_on,values,photo_uri').order('measured_on', { ascending: false });
    if (!ms.error) setMeasurements(ms.data.map((m: any) => ({ id: m.id, date: m.measured_on, values: m.values, photoUri: m.photo_uri })));

    const tr = await AsyncStorage.getItem(`reps:trainer:${uid}`);
    trainerRef.current = tr ? JSON.parse(tr) : null;
    setTrainerState(trainerRef.current);
    const wp = await AsyncStorage.getItem(`reps:wprefs:${uid}`);
    prefsRef.current = { ...DEFAULT_WPREFS, ...(wp ? JSON.parse(wp) : {}) };
    setWprefsState(prefsRef.current);
    const pn = await AsyncStorage.getItem(`reps:pinned:${uid}`);
    pinnedRef.current = pn ? { exercise: {}, routine: {}, ...JSON.parse(pn) } : { exercise: {}, routine: {} };
    const raw = await AsyncStorage.getItem(`reps:active:${uid}`);
    activeRef.current = raw ? JSON.parse(raw) : null;
    setActiveState(activeRef.current);
    setError(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setExercises([]); setWorkouts([]); setRoutines([]); setMeasurements([]); setProfile(EMPTY_PROFILE); trainerRef.current = null; setTrainerState(null); activeRef.current = null; setActiveState(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Carrega os dados do servidor quando o usuário entra (busca assíncrona).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userId) load(userId, session?.user.email ?? 'user').finally(() => setReady(true));
  }, [userId, session?.user.email, load]);

  const ensure = useCallback(async (ids: string[]): Promise<string[]> => {
      const have = new Map(exRef.current.filter((e) => e.catalogId).map((e) => [e.catalogId!, e.id]));
      const missing = [...new Set(ids.filter((id) => id.startsWith('cat:')).map((id) => id.slice(4)).filter((cid) => !have.has(cid)))];
      if (missing.length) {
        const rows = missing.flatMap((cid) => { const c = CAT_BY_ID.get(cid); return c ? [{ name: c.n, muscle: c.m, equipment: c.e, kind: c.k, catalog_id: cid }] : []; });
        const { data, error: e } = await supabase.from('exercises').insert(rows).select('id,name,muscle,equipment,kind,catalog_id');
        if (e) { fail(e.message); return ids; }
        const added: Exercise[] = data.map((r: any) => { const c = CAT_BY_ID.get(r.catalog_id); return { id: r.id, name: c?.n ?? r.name, muscle: c?.m ?? r.muscle, equipment: c?.e ?? r.equipment, kind: (c?.k ?? r.kind) as Exercise['kind'], catalogId: r.catalog_id }; });
        added.forEach((a) => have.set(a.catalogId!, a.id));
        exRef.current = [...exRef.current.filter((x) => !added.some((a) => a.id === x.id)), ...added];
        setExercises(exRef.current);
      }
      return ids.map((id) => (id.startsWith('cat:') ? have.get(id.slice(4)) ?? id : id));
  }, [fail]);

  const allExercises = useMemo<Exercise[]>(() => {
    const byCat = new Map(exercises.filter((e) => e.catalogId).map((e) => [e.catalogId!, e]));
    const fromCatalog = CATALOG.map((c) => byCat.get(c.id) ?? catToExercise(c));
    return [...fromCatalog, ...exercises.filter((e) => !e.catalogId)];
  }, [exercises]);

  const lookup = useMemo(() => {
    const m = new Map<string, Exercise>();
    allExercises.forEach((e) => { m.set(e.id, e); if (e.catalogId) m.set(`cat:${e.catalogId}`, e); });
    return m;
  }, [allExercises]);

  const allExRef = useRef<Exercise[]>([]);
  const startRef = useRef<(opts?: { routine?: Routine | null; entries?: SavedEntry[]; title?: string; trainerUid?: string }) => void>(() => {});
  const persistTrainer = useCallback((p: TrainerProgram | null) => {
    trainerRef.current = p;
    setTrainerState(p);
    if (userId) (p ? AsyncStorage.setItem(`reps:trainer:${userId}`, JSON.stringify(p)) : AsyncStorage.removeItem(`reps:trainer:${userId}`)).catch(() => {});
  }, [userId]);

  /** Ao terminar um treino do Trainer: avança para o próximo; fecha a semana/ciclo e renova os exercícios conforme a variedade. */
  const advanceTrainer = useCallback((doneUid: string) => {
    const p = trainerRef.current;
    if (!p) return;
    const i = p.workouts.findIndex((x) => x.uid === doneUid);
    const nextUid = p.workouts[(i + 1) % p.workouts.length]?.uid ?? p.nextUid;
    const completed = p.completed + 1;
    const freq = p.settings.frequency;
    const enOf = (e: Exercise) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en : undefined);
    const cycleDone = completed >= freq * (CYCLE_WEEKS + (p.settings.deload ? 1 : 0));
    const weekDone = completed % freq === 0;
    if ((cycleDone && p.settings.variety !== 'consistent') || (weekDone && p.settings.variety === 'varied')) {
      const nxt = generateProgram(p.settings, allExRef.current, enOf, p.seed + 1, p.name, cycleDone ? p.cycle + 1 : p.cycle, p);
      persistTrainer({ ...nxt, startedAt: p.startedAt, completed: cycleDone ? 0 : completed });
      return;
    }
    persistTrainer({ ...p, completed: cycleDone ? 0 : completed, cycle: cycleDone ? p.cycle + 1 : p.cycle, nextUid });
  }, [persistTrainer]);
  const value_startWorkout = (opts?: { routine?: Routine | null; entries?: SavedEntry[]; title?: string; trainerUid?: string }) => startRef.current(opts);

  const value = useMemo<Store>(() => ({
    ready, session, error, toast, profile, exercises, workouts, routines, measurements, active, rest, showToast, allExercises,
    ensureExercises: ensure,
    findExercise: (id) => lookup.get(id),
    wprefs,
    setWprefs: (patch) => { prefsRef.current = { ...prefsRef.current, ...patch }; setWprefsState(prefsRef.current); if (userId) AsyncStorage.setItem(`reps:wprefs:${userId}`, JSON.stringify(prefsRef.current)).catch(() => {}); },
    previousSets: (id) => lastSetsOf(id, activeRef.current?.fromRoutineId),
    realExerciseId: (id) => (id.startsWith('cat:') ? exRef.current.find((e) => e.catalogId === id.slice(4))?.id ?? id : id),
    signIn: async (email, password) => {
      const m = (await supabase.auth.signInWithPassword({ email, password })).error?.message ?? null;
      track(m ? 'login_failed' : 'login_completed');
      return m;
    },
    signUp: async (email, password) => {
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      if (e) { track('sign_up_failed'); return e.message; }
      track('sign_up_completed', { needs_confirmation: !data.session });
      return data.session ? null : 'Account created. Confirm the email we sent and then sign in.';
    },
    resetPassword: async (email) => (await supabase.auth.resetPasswordForEmail(email)).error?.message ?? null,
    signOut: async () => { track('logout'); await supabase.auth.signOut(); },

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
      const { data, error: e } = await supabase.from('exercises').insert({ name: x.name.trim(), muscle: x.muscle, equipment: x.equipment, kind: x.kind, target: x.target ?? null, secondary_muscles: x.secondary ?? [] }).select('id,name,muscle,equipment,kind').single();
      if (e) { fail(e.message); return null; }
      const row: Exercise = { ...(data as Exercise), catalogId: null, target: x.target ?? null, secondary: x.secondary ?? [], assetUri: x.assetUri ?? null };
      if (x.assetUri) {
        const map = JSON.parse((await AsyncStorage.getItem('reps:exassets').catch(() => null)) ?? '{}');
        map[row.id] = x.assetUri;
        AsyncStorage.setItem('reps:exassets', JSON.stringify(map)).catch(() => {});
      }
      setExercises((l) => [...l, row]);
      return row;
    },
    removeExercise: async (id) => {
      const { error: e } = await supabase.from('exercises').delete().eq('id', id);
      if (e) return fail(e.message);
      setExercises((l) => l.filter((x) => x.id !== id));
    },

    startWorkout: (opts) => {
      const src = opts?.entries ?? opts?.routine?.exercises ?? [];
      const entries: ActiveEntry[] = src.map((e) => ({
        uid: randomUUID(), exerciseId: e.exerciseId, ...noteFields(startNotes(e.exerciseId, e.notes ?? '', opts)), restSec: e.restSec ?? 0, superset: e.superset ?? null,
        sets: (e.sets.length ? e.sets : ([{ type: 'normal', kg: null, reps: null }] as SetRow[])).map((s, j): ActiveSet => {
          // campos vazios/zerados vêm preenchidos com o que foi feito da última vez
          const last = lastSetsOf(e.exerciseId, opts?.routine?.id);
          const p = last.length ? last[Math.min(j, last.length - 1)] : null;
          return p && !s.kg ? { ...s, kg: p.kg, reps: p.reps ?? s.reps, done: false } : { ...s, done: false };
        }),
      }));
      track('workout_started', { source: opts?.trainerUid ? 'trainer' : opts?.routine ? 'routine' : opts?.entries ? 'copy' : 'empty', exercises: entries.length });
      activeRef.current = { id: randomUUID(), title: opts?.title ?? opts?.routine?.title ?? 'Workout', startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0, entries, fromRoutineId: opts?.routine?.id ?? null, fromTrainer: opts?.trainerUid ?? null };
      setActiveState(activeRef.current);
      if (userId) AsyncStorage.setItem(`reps:active:${userId}`, JSON.stringify(activeRef.current)).catch(() => {});
    },
    trainer,
    saveTrainer: (p) => persistTrainer(p),
    startTrainerWorkout: (tuid) => {
      const w = trainerRef.current?.workouts.find((x) => x.uid === tuid);
      if (!w) return;
      const entries: SavedEntry[] = w.exercises.map((e) => ({
        exerciseId: e.exerciseId, notes: '', restSec: e.restSec, superset: null,
        sets: (suggestSets(lastSetsOf(e.exerciseId), e, lookup.get(e.exerciseId)?.equipment ?? '') ?? Array.from({ length: e.sets }, () => ({ kg: null, reps: e.repMax }))).map((x) => ({ type: 'normal' as const, kg: x.kg, reps: x.reps })),
      }));
      track('trainer_workout_started', { kind: w.kind, exercises: w.exercises.length });
      value_startWorkout({ entries, title: w.title, trainerUid: tuid });
    },
    skipTrainerWorkout: (tuid) => {
      const p = trainerRef.current;
      if (!p) return;
      const i = p.workouts.findIndex((x) => x.uid === tuid);
      track('trainer_workout_skipped');
      persistTrainer({ ...p, nextUid: p.workouts[(i + 1) % p.workouts.length].uid });
    },
    setActiveTitle: (t) => setActive((a) => ({ ...a, title: t })),
    addEntries: (ids) => setActive((a) => ({ ...a, entries: [...a.entries, ...ids.map((id): ActiveEntry => {
      const last = lastSetsOf(id, activeRef.current?.fromRoutineId);
      const pins = readPins('exercise', id).map((text): EntryNote => ({ id: randomUUID(), text, kind: 'exercise' }));
      return { uid: randomUUID(), exerciseId: id, ...noteFields(pins), restSec: prefsRef.current.defaultRestSec, sets: last.length ? last.map((p): ActiveSet => ({ type: p.type, kg: p.kg, reps: p.reps, done: false })) : [newSet()] };
    })] })),
    removeEntry: (i) => setActive((a) => ({ ...a, entries: a.entries.filter((_, k) => k !== i) })),
    pinnedNotes: (exerciseId) => readPins('exercise', exerciseId),
    setPinnedNotes: (exerciseId, texts) => writePins('exercise', exerciseId, null, texts.filter((x) => x.trim())),
    addNote: (i) => {
      const e = activeRef.current?.entries[i];
      if (!e) return '';
      const last = notesOf(e).at(-1);
      if (last && !last.text) return last.id; // já há uma nota em branco: usa ela
      const id = randomUUID();
      setActive((cur) => ({ ...cur, entries: cur.entries.map((x, k) => (k === i ? { ...x, ...noteFields([...notesOf(x), { id, text: '', kind: 'workout' }]) } : x)) }));
      return id;
    },
    setNote: (i, id, text) => {
      const a = activeRef.current, e = a?.entries[i];
      if (!a || !e) return;
      const list = notesOf(e).map((n) => (n.id === id ? { ...n, text } : n));
      setActive((cur) => ({ ...cur, entries: cur.entries.map((x, k) => (k === i ? { ...x, ...noteFields(list) } : x)) }));
      syncPins(e, list, a.fromRoutineId);
    },
    setNoteKind: (i, id, kind) => {
      const a = activeRef.current, e = a?.entries[i];
      if (!a || !e) return;
      if (kind === 'routine' && !a.fromRoutineId) return showToast('Start this workout from a routine to pin a routine note.');
      const list = notesOf(e).map((n) => (n.id === id ? { ...n, kind } : n));
      setActive((cur) => ({ ...cur, entries: cur.entries.map((x, k) => (k === i ? { ...x, ...noteFields(list) } : x)) }));
      syncPins(e, list, a.fromRoutineId);
    },
    deleteNote: (i, id) => {
      const a = activeRef.current, e = a?.entries[i];
      if (!a || !e) return;
      const list = notesOf(e).filter((n) => n.id !== id);
      setActive((cur) => ({ ...cur, entries: cur.entries.map((x, k) => (k === i ? { ...x, ...noteFields(list) } : x)) }));
      syncPins(e, list, a.fromRoutineId);
    },
    moveEntry: (from, to) => setActive((a) => { const list = [...a.entries]; const [it] = list.splice(from, 1); list.splice(to, 0, it); return { ...a, entries: list }; }),
    swapEntry: (i, id) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => {
      if (k !== i || e.exerciseId === id) return e;
      const original = e.swappedFrom ?? e.exerciseId;
      const last = lastSetsOf(id, a.fromRoutineId);
      // séries ainda não feitas passam a usar o histórico do novo exercício (ou ficam sem peso, para não herdar o do outro)
      const sets = e.sets.map((s, j): ActiveSet => {
        if (s.done) return s;
        const p = last.length ? last[Math.min(j, last.length - 1)] : null;
        return p ? { ...s, kg: p.kg, reps: p.reps ?? s.reps, typed: false } : { ...s, kg: null, typed: false };
      });
      return { ...e, exerciseId: id, swappedFrom: id === original ? undefined : original, sets };
    }) })),
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
      if (willBeDone && prefsRef.current.livePR) {
        const rec = records(wkRef.current, (cur.exerciseId.startsWith('cat:') ? exRef.current.find((e) => e.catalogId === cur.exerciseId.slice(4))?.id ?? cur.exerciseId : cur.exerciseId));
        if (prFlags(rec, cur.sets.map((s, n) => (n === j ? { ...s, done: true } : s)))[j]) { showToast('New personal record!'); playSound('sfx_record', prefsRef.current.prVolume); }
      }
      if (willBeDone) playSound('sfx_check', prefsRef.current.checkVolume);
      if (willBeDone) track('set_completed', { type: cur.sets[j].type, has_weight: (cur.sets[j].kg ?? 0) > 0 });
      if (willBeDone && cur.restSec > 0) setRest({ endsAt: Date.now() + cur.restSec * 1000, total: cur.restSec });
    },
    pauseToggle: () => setActive((a) => a.pausedAt
      ? { ...a, pausedMs: a.pausedMs + (Date.now() - new Date(a.pausedAt).getTime()), pausedAt: null }
      : { ...a, pausedAt: new Date().toISOString() }),
    setStartTime: (iso) => setActive((a) => ({ ...a, dateAt: iso })),
    completeTypedSets: () => setActive((a) => ({ ...a, entries: a.entries.map((e) => (e.hidden ? e : { ...e, sets: e.sets.map((s) => (!s.done && s.typed && ((s.kg ?? 0) > 0 || (s.reps ?? 0) > 0) ? { ...s, done: true } : s)) })) })),
    setElapsed: (sec) => setActive((a) => ({ ...a, pausedMs: 0, pausedAt: a.pausedAt ? new Date().toISOString() : null, startedAt: new Date(Date.now() - sec * 1000).toISOString() })),
    discardActive: () => { track('workout_discarded'); setActive(() => null); setRest(null); },
    finishActive: async (meta) => {
      const a = activeRef.current;
      if (!a) return null;
      const entries: SavedEntry[] = a.entries
        .filter((e) => !e.hidden)
        .map((e) => ({ exerciseId: e.exerciseId, notes: workoutText(notesOf(e)), restSec: e.restSec, superset: e.superset ?? null, sets: e.sets.filter((s) => s.done).map(({ done: _d, typed: _t, ...s }) => s) }))
        .filter((e) => e.sets.length > 0);
      if (!entries.length) { fail('Complete at least one set to save the workout.'); return null; }
      const realIds = await ensure([...new Set(entries.map((e) => e.exerciseId))]);
      const idMap = new Map([...new Set(entries.map((e) => e.exerciseId))].map((id, k) => [id, realIds[k]]));
      entries.forEach((e) => { e.exerciseId = idMap.get(e.exerciseId) ?? e.exerciseId; });
      const w = await saveWorkoutRpc({ id: a.id, date: meta.date, title: meta.title || 'Workout', description: meta.description, durationSec: meta.durationSec, visibility: meta.visibility, routineId: a.fromRoutineId ?? null, location: meta.location || null, fromTrainer: !!a.fromTrainer }, entries);
      if (w.error) { reportError(w.error, { where: 'save-workout' }); fail(w.error.message); return null; }
      const saved: Workout = { id: a.id, date: meta.date, title: meta.title || 'Workout', description: meta.description, durationSec: meta.durationSec, visibility: meta.visibility, entries, routineId: a.fromRoutineId ?? null, location: meta.location || null };
      if (a.fromTrainer) { saved.fromTrainer = true; advanceTrainer(a.fromTrainer); }
      track('workout_finished', {
        source: a.fromTrainer ? 'trainer' : a.fromRoutineId ? 'routine' : 'empty', duration_min: Math.round(meta.durationSec / 60),
        exercises: entries.length, sets: entries.reduce((t, e) => t + e.sets.length, 0), visibility: meta.visibility, has_location: !!meta.location,
        workouts_total: wkRef.current.length + 1,
      });
      setWorkouts((l) => [saved, ...l]);
      setActive(() => null);
      setRest(null);
      return saved;
    },

    startRest: (sec) => setRest({ endsAt: Date.now() + sec * 1000, total: sec }),
    adjustRest: (d) => setRest((r) => (r ? { endsAt: r.endsAt + d * 1000, total: Math.max(1, r.total + d) } : r)),
    skipRest: () => setRest(null),

    updateWorkout: async (id, patch) => {
      const old = wkRef.current.find((w) => w.id === id);
      if (!old) return false;
      const entries = patch.entries.map((e) => ({ ...e, sets: e.sets.filter((x) => (x.reps ?? 0) > 0 || (x.kg ?? 0) > 0) })).filter((e) => e.sets.length > 0);
      if (!entries.length) { fail('A workout needs at least one set.'); return false; }
      const realIds = await ensure([...new Set(entries.map((e) => e.exerciseId))]);
      const idMap = new Map([...new Set(entries.map((e) => e.exerciseId))].map((x, k) => [x, realIds[k]]));
      entries.forEach((e) => { e.exerciseId = idMap.get(e.exerciseId) ?? e.exerciseId; });
      const u = await saveWorkoutRpc({ id, date: patch.date, title: patch.title || 'Workout', description: patch.description, durationSec: patch.durationSec, visibility: patch.visibility, routineId: old.routineId ?? null, location: patch.location || null, fromTrainer: !!old.fromTrainer }, entries);
      if (u.error) { reportError(u.error, { where: 'update-workout' }); fail(u.error.message); return false; }
      setWorkouts((l) => l.map((w) => (w.id === id ? { ...w, title: patch.title || 'Workout', description: patch.description, date: patch.date, visibility: patch.visibility, location: patch.location || null, durationSec: patch.durationSec, entries } : w)).sort((a, b) => +new Date(b.date) - +new Date(a.date)));
      return true;
    },
    deleteWorkout: async (id) => {
      const { error: e } = await supabase.from('workouts').delete().eq('id', id);
      if (e) return fail(e.message);
      setWorkouts((l) => l.filter((w) => w.id !== id));
    },

    saveRoutine: async (r) => {
      const uniq = [...new Set(r.exercises.map((e) => e.exerciseId))];
      const realIds = await ensure(uniq);
      const idMap = new Map(uniq.map((id, k) => [id, realIds[k]]));
      // O gatilho `routines_sync_children` monta routine_exercises/routine_sets na mesma transação; a coluna JSON fica para o app antigo.
      const row = { title: r.title.trim() || 'Routine', notes: r.notes, exercises: r.exercises.map((e) => ({ ...e, exerciseId: idMap.get(e.exerciseId) ?? e.exerciseId })) as RoutineExercise[] };
      const q = r.id ? supabase.from('routines').update(row).eq('id', r.id) : supabase.from('routines').insert(row);
      const { data, error: e } = await q.select('id').single();
      if (e) { reportError(e, { where: 'save-routine' }); fail(e.message); return null; }
      const saved: Routine = { id: data.id, ...row };
      setRoutines((l) => (r.id ? l.map((x) => (x.id === r.id ? saved : x)) : [saved, ...l]));
      return saved;
    },
    deleteRoutine: async (id) => {
      const { error: e } = await supabase.from('routines').delete().eq('id', id);
      if (e) return fail(e.message);
      setRoutines((l) => l.filter((x) => x.id !== id));
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
  }), [ready, session, error, toast, profile, exercises, workouts, routines, measurements, active, rest, userId, setActive, fail, showToast, allExercises, ensure, lookup, lastSetsOf, wprefs, trainer, persistTrainer, advanceTrainer, readPins, writePins, syncPins, startNotes]);

  useEffect(() => { startRef.current = value.startWorkout; allExRef.current = allExercises; });
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used within StoreProvider');
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
