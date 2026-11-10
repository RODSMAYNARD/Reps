import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { randomUUID } from './uuid';
import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CAT_BY_ID, CATALOG, catName, catToExercise } from './catalog';
import { useLang } from './i18n';
import { track } from './analytics';
import { reportError } from './monitoring';
import { setHasValue } from './exerciseOptions';
import { noteFields, notesOf, workoutText } from './notes';
import { isNetworkError, OFFLINE_MSG, readDeletes, readOutbox, readSnapshot, saveSnapshot, writeDeletes, writeOutbox, type PendingWorkout } from './offline';
import { playSound } from './sounds';
import { cancelReminders } from './reminders';
import { prFlags, records, setExerciseLookup } from './stats';
import { CYCLE_WEEKS, DEFAULT_TRAINER, generateProgram, suggestSets } from './trainer';
import { supabase } from './supabase';
import {
  ActiveEntry, ActiveSet, ActiveWorkout, DEFAULT_WPREFS, EntryNote, NoteKind, Exercise, Measurement, Profile, Routine, RoutineExercise, SavedEntry, SetRow, TrainerProgram, Units, Workout, WorkoutPrefs,
} from './types';

export const DEFAULT_UNITS: Units = { weight: 'kg', distance: 'km', body: 'cm' };
const EMPTY_PROFILE: Profile = { username: '', displayName: '', bio: '', link: '', sex: null, birthYear: null, weightKg: null, units: DEFAULT_UNITS, theme: 'system', isPrivate: false, onboarded: false };

export const elapsedSec = (a: ActiveWorkout, now = Date.now()) => {
  const end = a.pausedAt ? new Date(a.pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(a.startedAt).getTime() - a.pausedMs) / 1000));
};

/** Tempo e distância só entram na série quando existem (tipos com distância/tempo). */
const withExtra = (r: SetRow, s: { duration_sec?: number | null; distance_m?: number | string | null }): SetRow =>
  ({ ...r, ...(s.duration_sec != null ? { seconds: s.duration_sec } : {}), ...(s.distance_m != null ? { distM: Number(s.distance_m) } : {}) });

/** Junta os treinos da fila (ainda não enviados) à lista do servidor, sem repetir, do mais novo para o mais antigo. */
const mergePending = (queued: Workout[], server: Workout[]) => {
  const ids = new Set(server.map((w) => w.id));
  return [...queued.filter((w) => !ids.has(w.id)).map((w) => ({ ...w, pending: true })), ...server].sort((a, b) => +new Date(b.date) - +new Date(a.date));
};

const byPosition = <T extends { position: number }>(rows: T[] | null | undefined) => [...(rows ?? [])].sort((a, b) => a.position - b.position);

/** Grava treino + exercícios + séries numa transação (função `save_workout` no banco). `meta` continua sendo gravado para o app antigo ainda instalado. */
const saveWorkoutRpc = (w: { id: string; date: string; title: string; description: string; durationSec: number; visibility: Workout['visibility']; routineId: string | null; location: string | null; fromTrainer: boolean }, entries: SavedEntry[]) =>
  supabase.rpc('save_workout', {
    p_workout: {
      id: w.id, performed_at: w.date, title: w.title, description: w.description, duration_sec: Math.round(w.durationSec), visibility: w.visibility,
      routine_id: w.routineId, location: w.location, from_trainer: w.fromTrainer,
      meta: {
        notes: Object.fromEntries(entries.filter((e) => e.notes).map((e) => [e.exerciseId, e.notes])),
        rest: Object.fromEntries(entries.filter((e) => e.restSec).map((e) => [e.exerciseId, e.restSec])),
        superset: Object.fromEntries(entries.filter((e) => e.superset != null).map((e) => [e.exerciseId, e.superset])),
        routineId: w.routineId, location: w.location, trainer: w.fromTrainer || undefined,
      },
    },
    p_entries: entries.map((e) => ({
      exercise_id: e.exerciseId, notes: e.notes, rest_sec: e.restSec, superset: e.superset ?? null, weight_unit: e.unit ?? null,
      sets: e.sets.map((s) => ({ set_type: s.type, weight: s.kg ?? 0, reps: s.reps ?? 0, duration_sec: s.seconds == null ? null : Math.round(s.seconds), distance_m: s.distM ?? null })),
    })),
  });

/** Programa salvo por um build antigo pode não ter as opções novas: completa com os padrões (senão telas do Trainer quebravam). */
const withTrainerDefaults = (t: TrainerProgram | null): TrainerProgram | null => (t ? { ...t, settings: { ...DEFAULT_TRAINER, ...t.settings } } : t);

/** Trainer/preferências que não chegaram ao servidor (sem internet): ficam marcados e sobem na próxima carga, em vez de a cópia do servidor vencer. */
let dirtyChain: Promise<unknown> = Promise.resolve();
// uma gravação por vez: duas marcações juntas (trainer + preferências) liam o mesmo valor e uma apagava a outra
const markDirty = (uid: string, field: 'trainer' | 'wprefs', dirty: boolean) => {
  dirtyChain = dirtyChain.then(() => AsyncStorage.getItem(`reps:dirty:${uid}`).then((raw) => AsyncStorage.setItem(`reps:dirty:${uid}`, JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), [field]: dirty })))).catch(() => {});
};

/** Notas fixadas que ainda não chegaram ao banco (`escopo|chave`), guardadas por usuário. */
const savePinDirty = (uid: string, set: Set<string>) => AsyncStorage.setItem(`reps:pinned-dirty:${uid}`, JSON.stringify([...set])).catch(() => {});

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : typeof v === 'string' && v ? [v] : []);

/** Sessão guardada no aparelho (chave padrão do supabase-js). Usada quando abre sem internet com o token vencido: o supabase devolve
 * "sem sessão", mas ela continua guardada e renova sozinha quando a conexão voltar. */
const readStoredSession = async (): Promise<Session | null> => {
  try {
    const key = `sb-${new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;
    const s = JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');
    return s?.user?.id && s.access_token && s.refresh_token ? (s as Session) : null;
  } catch { return null; }
};

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
  /** Conclui a recuperação: confere o código de 6 dígitos do e-mail e define a nova senha. Devolve a mensagem de erro, ou null. */
  completePasswordReset: (email: string, code: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Apaga a conta e todos os dados (Edge Function `delete-account`), limpa o aparelho e sai. Devolve a mensagem de erro, ou null. */
  deleteAccount: () => Promise<string | null>;
  // perfil
  saveProfile: (patch: Partial<Profile>) => Promise<boolean>;
  /** true quando a carga inicial dos dados falhou (rede/servidor): a raiz mostra "tentar de novo" em vez de cair no onboarding. */
  loadFailed: boolean;
  reload: () => void;
  /** Sem conexão com o servidor: o app mostra a cópia salva no aparelho e guarda os treinos novos numa fila. */
  offline: boolean;
  /** Treinos salvos sem internet esperando para subir. */
  pendingCount: number;
  // exercícios
  addExercise: (x: Omit<Exercise, 'id'>) => Promise<Exercise | null>;
  removeExercise: (id: string) => Promise<void>;
  /** Edita um exercício criado pelo usuário (os do catálogo não mudam). */
  updateExercise: (id: string, x: Omit<Exercise, 'id'>) => Promise<boolean>;
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
  /** Notas fixadas DESTA rotina para o exercício (aparecem sempre que o treino é iniciado dela). */
  routinePins: (routineId: string, exerciseId: string) => string[];
  setRoutinePins: (routineId: string, exerciseId: string, texts: string[]) => void;
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
  saveMeasurement: (m: Omit<Measurement, 'id'> & { id?: string }) => Promise<boolean>;
  deleteMeasurement: (id: string) => Promise<boolean>;
  // feedback
  sendFeedback: (kind: 'feature' | 'report' | 'contact', body: string, ref?: string) => Promise<boolean>;
  showToast: (t: string, ms?: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [active, setActiveState] = useState<ActiveWorkout | null>(null);
  const [rest, setRest] = useState<RestTimer>(null);
  const lang = useLang();
  const userId = session?.user.id ?? null;
  const activeRef = useRef<ActiveWorkout | null>(null);
  /** Usuário cujos dados estão (ou vão estar) na tela; muda junto com a sessão. */
  const uidRef = useRef<string | null>(null);
  /** Sessão lida do aparelho sem conseguir renovar (offline com token vencido): abre com a cópia local até a renovação dar certo. */
  const offlineAuthRef = useRef(false);
  /** Treinos salvos/apagados e exercícios criados enquanto a carga roda: a lista que ela leu do servidor (antes) não os conhece. */
  const duringLoad = useRef({ saved: new Set<string>(), deleted: new Set<string>(), exercises: new Set<string>() });
  const exRef = useRef<Exercise[]>([]);
  useEffect(() => { exRef.current = exercises; }, [exercises]);
  /** Notas fixadas (só no aparelho): listas por exercício e por rotina+exercício. Chave = id canônico (catálogo = cat:<id>). */
  const pinnedRef = useRef<{ exercise: Record<string, string[]>; routine: Record<string, string[]> }>({ exercise: {}, routine: {} });
  const pinKey = useCallback((exerciseId: string) => {
    const ex = exRef.current.find((e) => e.id === exerciseId);
    return ex?.catalogId ? `cat:${ex.catalogId}` : exerciseId;
  }, []);
  const pinTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pinRuns = useRef<Record<string, () => void>>({});
  const pinChain = useRef<Promise<unknown>>(Promise.resolve());
  /** Chaves (`escopo|chave`) mudadas no aparelho que o banco ainda não confirmou: na próxima carga a versão do aparelho vence (inclusive apagar). */
  const pinDirtyRef = useRef<Set<string>>(new Set());
  const readPins = useCallback((kind: 'exercise' | 'routine', exerciseId: string, routineId?: string | null): string[] =>
    asList(kind === 'exercise' ? pinnedRef.current.exercise[pinKey(exerciseId)] : routineId ? pinnedRef.current.routine[`${routineId}:${pinKey(exerciseId)}`] : undefined), [pinKey]);
  const writePins = useCallback((kind: 'exercise' | 'routine', exerciseId: string, routineId: string | null | undefined, texts: string[]) => {
    const map = kind === 'exercise' ? pinnedRef.current.exercise : pinnedRef.current.routine;
    const key = kind === 'exercise' ? pinKey(exerciseId) : routineId ? `${routineId}:${pinKey(exerciseId)}` : null;
    if (!key) return;
    if (texts.length) map[key] = texts; else delete map[key];
    if (userId) {
      const uid = userId;
      AsyncStorage.setItem(`reps:pinned:${uid}`, JSON.stringify(pinnedRef.current)).catch(() => {});
      // marca como pendente já (o app pode fechar antes de enviar, ou estar sem internet); só sai da lista quando o banco confirmar
      const scope = kind, tid = `${scope}|${key}`;
      pinDirtyRef.current.add(tid);
      savePinDirty(uid, pinDirtyRef.current);
      const curOf = () => (scope === 'exercise' ? pinnedRef.current.exercise : pinnedRef.current.routine)[key];
      // no banco: espera a digitação parar e grava a versão mais nova, um pedido por vez (um pedido por tecla chegava fora de ordem)
      clearTimeout(pinTimers.current[tid]);
      const run = () => {
        delete pinTimers.current[tid]; delete pinRuns.current[tid];
        const send = async () => {
          if (uidRef.current !== uid) return; // trocou de conta: continua marcada e sobe na próxima carga dela
          const cur = curOf(), sent = JSON.stringify(cur ?? null);
          const err = await (cur?.length
            ? supabase.from('pinned_notes').upsert({ user_id: uid, scope, key, texts: cur }, { onConflict: 'user_id,scope,key' })
            : supabase.from('pinned_notes').delete().eq('user_id', uid).eq('scope', scope).eq('key', key)).then((r) => r.error, (x) => x);
          if (err || pinTimers.current[tid] || uidRef.current !== uid || JSON.stringify(curOf() ?? null) !== sent) return;
          pinDirtyRef.current.delete(tid);
          savePinDirty(uid, pinDirtyRef.current);
        };
        pinChain.current = pinChain.current.then(send, send);
      };
      pinRuns.current[tid] = run;
      pinTimers.current[tid] = setTimeout(run, 800);
    }
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
  /** Notas de um exercício que entra no lugar de outro: as fixadas dele (rotina e exercício) + as notas do treino que já existiam. */
  const notesFor = useCallback((exerciseId: string, e: ActiveEntry, routineId?: string | null): EntryNote[] => [
    ...(routineId ? readPins('routine', exerciseId, routineId) : []).map((text): EntryNote => ({ id: randomUUID(), text, kind: 'routine' })),
    ...readPins('exercise', exerciseId).map((text): EntryNote => ({ id: randomUUID(), text, kind: 'exercise' })),
    ...notesOf(e).filter((n) => n.kind === 'workout'),
  ], [readPins]);
  const [trainer, setTrainerState] = useState<TrainerProgram | null>(null);
  const trainerRef = useRef<TrainerProgram | null>(null);
  const [wprefs, setWprefsState] = useState<WorkoutPrefs>(DEFAULT_WPREFS);
  const prefsRef = useRef<WorkoutPrefs>(DEFAULT_WPREFS);
  /** Trainer/preferências no servidor: marca como pendente na hora, espera as mudanças pararem e envia a versão mais nova, um pedido por vez
   * (pedidos soltos podiam chegar fora de ordem: o servidor ficava com a versão velha e ela vencia na próxima carga). */
  const stateSeq = useRef({ trainer: 0, wprefs: 0 });
  const stateTimers = useRef<Partial<Record<'trainer' | 'wprefs', ReturnType<typeof setTimeout>>>>({});
  const stateChain = useRef<Promise<unknown>>(Promise.resolve());
  const pushState = useCallback((field: 'trainer' | 'wprefs') => {
    const uid = uidRef.current;
    if (!uid) return;
    const seq = ++stateSeq.current[field];
    markDirty(uid, field, true);
    clearTimeout(stateTimers.current[field]);
    stateTimers.current[field] = setTimeout(() => {
      delete stateTimers.current[field];
      const send = async () => {
        if (uidRef.current !== uid) return; // trocou de conta: continua marcado e sobe na próxima carga dela
        const row: { user_id: string; trainer?: TrainerProgram | null; wprefs?: WorkoutPrefs } = field === 'trainer' ? { user_id: uid, trainer: trainerRef.current } : { user_id: uid, wprefs: prefsRef.current };
        const err = await supabase.from('user_state').upsert(row, { onConflict: 'user_id' }).then((r) => r.error, (x) => x);
        // só desmarca se nada mudou depois (a mudança seguinte manda a versão nova e desmarca ela)
        if (!err && stateSeq.current[field] === seq && uidRef.current === uid) markDirty(uid, field, false);
      };
      stateChain.current = stateChain.current.then(send, send);
    }, 600);
  }, []);
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

  /** Unidade escolhida da última vez para o exercício (Weight Input); sem escolha = undefined (vale a do perfil). */
  const lastUnitOf = useCallback((exerciseId: string) => {
    const real = exerciseId.startsWith('cat:') ? exRef.current.find((e) => e.catalogId === exerciseId.slice(4))?.id ?? exerciseId : exerciseId;
    for (const w of wkRef.current) { const en = w.entries.find((e) => e.exerciseId === real); if (en) return en.unit; }
    return undefined;
  }, []);

  const showToast = useCallback((t: string, ms = 2500) => {
    setToast(t);
    setTimeout(() => setToast((c) => (c === t ? null : c)), ms);
  }, []);
  const fail = useCallback((m: string) => { const msg = isNetworkError(m) ? OFFLINE_MSG : m; setError(msg); showToast(msg); }, [showToast]);

  const setActive = useCallback((fn: (a: ActiveWorkout) => ActiveWorkout | null) => {
    const next = activeRef.current ? fn(activeRef.current) : null;
    activeRef.current = next;
    setActiveState(next);
    if (userId) (next ? AsyncStorage.setItem(`reps:active:${userId}`, JSON.stringify(next)) : AsyncStorage.removeItem(`reps:active:${userId}`)).catch(() => {});
  }, [userId]);

  /** Linha do banco → medida da tela. Foto no Storage (`storage:<caminho>`) vira URL assinada; valores antigos (caminho local) seguem como estavam. */
  const toMeasurement = async (m: any): Promise<Measurement> => {
    const raw: string | null = m.photo_uri;
    if (raw?.startsWith('storage:')) {
      const path = raw.slice(8);
      const s = await supabase.storage.from('progress-photos').createSignedUrl(path, 60 * 60 * 24 * 7).catch(() => null);
      return { id: m.id, date: m.measured_on, values: m.values, photoUri: s?.data?.signedUrl ?? null, photoPath: path };
    }
    return { id: m.id, date: m.measured_on, values: m.values, photoUri: raw, photoPath: null };
  };
  const load = useCallback(async (uid: string, email: string) => {
    const dl = duringLoad.current = { saved: new Set<string>(), deleted: new Set<string>(), exercises: new Set<string>() };
    // o treino em andamento vive no aparelho: restaura ANTES de falar com o servidor, para não se perder offline
    try { const raw = await AsyncStorage.getItem(`reps:active:${uid}`); activeRef.current = raw ? JSON.parse(raw) : null; } catch { activeRef.current = null; }
    setActiveState(activeRef.current);
    const ex = await supabase.from('exercises').select('id,name,muscle,equipment,kind,catalog_id,target,secondary_muscles').order('created_at');
    if (ex.error) throw ex.error;
    const assets = JSON.parse((await AsyncStorage.getItem('reps:exassets').catch(() => null)) ?? '{}') as Record<string, string>;
    const serverEx: Exercise[] = ex.data.map((r: any) => { const c = r.catalog_id ? CAT_BY_ID.get(r.catalog_id) : undefined; return { id: r.id, name: c?.n ?? r.name, muscle: c?.m ?? r.muscle, equipment: c?.e ?? r.equipment, kind: (c?.k ?? r.kind) as Exercise['kind'], catalogId: r.catalog_id, target: r.target ?? null, secondary: r.secondary_muscles ?? [], assetUri: assets[r.id] ?? null }; });
    // exercício criado enquanto esta busca estava no ar (salvar treino/rotina) fica na lista
    setExercises((prev) => { const ids = new Set(serverEx.map((x) => x.id)); return [...serverEx, ...prev.filter((x) => dl.exercises.has(x.id) && !ids.has(x.id))]; });

    const fallbackName = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'athlete';
    const pr = await supabase.from('profiles').select('*').maybeSingle();
    if (pr.error) throw pr.error;
    // grava o nome de usuário; se outro já usa o mesmo (índice único), tenta com um número no fim
    const claimName = async () => {
      for (let i = 0; i < 5; i++) {
        const name = i ? `${fallbackName.slice(0, 16)}${Math.floor(1000 + Math.random() * 9000)}` : fallbackName;
        const r = await supabase.from('profiles').upsert({ user_id: uid, username: name });
        if (!r.error) return name;
        if (r.error.code !== '23505') throw r.error;
      }
      return '';
    };
    if (pr.data) {
      const p = pr.data;
      setProfile({ username: p.username || (await claimName()), displayName: p.display_name, bio: p.bio, link: p.link, sex: p.sex, birthYear: p.birth_year, weightKg: p.weight_kg ? Number(p.weight_kg) : null, units: { ...DEFAULT_UNITS, ...p.units }, theme: p.theme, isPrivate: p.is_private, onboarded: p.onboarded });
    } else {
      setProfile({ ...EMPTY_PROFILE, username: await claimName() });
    }

    // o servidor devolve no máximo ~1000 linhas por pedido: busca por páginas até acabar
    const rowsAll: any[] = [];
    let wk: { data: any[] | null; error: { message: string } | null } = { data: [], error: null };
    for (let from = 0; ; from += 1000) {
      const page = await supabase.from('workouts')
      .select('id,performed_at,title,description,duration_sec,visibility,routine_id,location,from_trainer,workout_exercises(exercise_id,position,notes,rest_sec,superset,weight_unit,workout_sets(position,reps,weight,set_type,duration_sec,distance_m))')
      .order('performed_at', { ascending: false }).range(from, from + 999);
      if (page.error) { wk = { data: null, error: page.error }; break; }
      rowsAll.push(...page.data);
      if (page.data.length < 1000) break;
    }
    if (!wk.error) wk = { data: rowsAll, error: null };
    if (wk.error) throw wk.error;
    const outbox = await readOutbox(uid);
    if (outbox.some((x) => x.failed)) await writeOutbox(uid, outbox.map(({ failed: _f, ...x }) => x));
    const queued = outbox.map((p) => p.workout);
    setPendingCount(queued.length);
    // apagados no aparelho que o servidor ainda não apagou: ficam fora da lista e o app tenta apagar de novo
    const deletes = await readDeletes(uid);
    if (deletes.length) supabase.from('workouts').delete().in('id', deletes).then((r) => { if (!r.error) writeDeletes(uid, []); }, () => {});
    const serverWk = wk.data!.filter((w: any) => !deletes.includes(w.id) && !dl.deleted.has(w.id)).map((w: any) => ({
      id: w.id, date: w.performed_at, title: w.title, description: w.description, durationSec: w.duration_sec, visibility: w.visibility,
      routineId: w.routine_id, location: w.location, fromTrainer: w.from_trainer,
      entries: byPosition(w.workout_exercises).map((e: any) => ({
        exerciseId: e.exercise_id, notes: e.notes, restSec: e.rest_sec, superset: e.superset, unit: e.weight_unit ?? undefined,
        sets: byPosition(e.workout_sets).map((s: any): SetRow => withExtra({ type: s.set_type, kg: Number(s.weight), reps: s.reps }, s)),
      })),
    } as Workout));
    // treino salvo enquanto a carga rodava (ex.: logo ao voltar a internet) não está nas páginas lidas: fica; apagado nesse meio tempo não volta
    setWorkouts((prev) => {
      const ids = new Set(serverWk.map((w) => w.id));
      return mergePending(queued.filter((w) => !dl.deleted.has(w.id)), [...prev.filter((w) => dl.saved.has(w.id) && !ids.has(w.id)), ...serverWk]);
    });

    const rt = await supabase.from('routines')
      .select('id,title,notes,routine_exercises(exercise_id,position,notes,rest_sec,superset,weight_unit,routine_sets(position,set_type,weight,reps,duration_sec,distance_m))')
      .order('created_at', { ascending: false });
    if (rt.error) throw rt.error;
    setRoutines(rt.data.map((r: any): Routine => ({
      id: r.id, title: r.title, notes: r.notes,
      exercises: byPosition(r.routine_exercises).map((e: any) => ({
        exerciseId: e.exercise_id, notes: e.notes, restSec: e.rest_sec, superset: e.superset, unit: e.weight_unit ?? undefined,
        sets: byPosition(e.routine_sets).map((s: any): SetRow => withExtra({ type: s.set_type, kg: s.weight == null ? null : Number(s.weight), reps: s.reps }, s)),
      })),
    })));
    const ms = await supabase.from('measurements').select('id,measured_on,values,photo_uri').order('measured_on', { ascending: false });
    if (ms.error) throw ms.error;
    setMeasurements(await Promise.all(ms.data.map((m: any) => toMeasurement(m))));

    // Trainer e preferências: o servidor (`user_state`) é a fonte; o AsyncStorage é cache/offline. O que só existe no aparelho sobe.
    const safe = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
    const localTrainer = safe(await AsyncStorage.getItem(`reps:trainer:${uid}`)) as TrainerProgram | null;
    const localPrefs = safe(await AsyncStorage.getItem(`reps:wprefs:${uid}`)) as Partial<WorkoutPrefs> | null;
    const dirty = (safe(await AsyncStorage.getItem(`reps:dirty:${uid}`).catch(() => null)) ?? {}) as { trainer?: boolean; wprefs?: boolean };
    const us = await supabase.from('user_state').select('trainer,wprefs').maybeSingle();
    const up: { user_id: string; trainer?: TrainerProgram | null; wprefs?: Partial<WorkoutPrefs> } = { user_id: uid };
    if (!us.error) {
      // linha existente com trainer nulo e sem marca de pendente = programa apagado (talvez em outro aparelho): o cache não o traz de volta
      const row = us.data;
      trainerRef.current = dirty.trainer ? localTrainer : row ? row.trainer ?? null : localTrainer;
      if (dirty.trainer || (!row && localTrainer)) up.trainer = localTrainer;
      if (row && !row.trainer && !dirty.trainer && localTrainer) AsyncStorage.removeItem(`reps:trainer:${uid}`).catch(() => {});
      const prefs = (dirty.wprefs ? localPrefs : us.data?.wprefs) ?? us.data?.wprefs ?? localPrefs;
      if ((dirty.wprefs || !us.data?.wprefs) && localPrefs) up.wprefs = localPrefs;
      prefsRef.current = { ...DEFAULT_WPREFS, ...(prefs ?? {}) };
      const seq0 = { ...stateSeq.current };
      // desmarca só o que subiu e não mudou de novo enquanto isso
      if (up.trainer !== undefined || up.wprefs) supabase.from('user_state').upsert(up, { onConflict: 'user_id' }).then((r) => { if (!r.error) (['trainer', 'wprefs'] as const).forEach((f) => { if (f in up && stateSeq.current[f] === seq0[f]) markDirty(uid, f, false); }); }, () => {});
      if (us.data?.trainer && !dirty.trainer) AsyncStorage.setItem(`reps:trainer:${uid}`, JSON.stringify(us.data.trainer)).catch(() => {});
      if (us.data?.wprefs && !dirty.wprefs) AsyncStorage.setItem(`reps:wprefs:${uid}`, JSON.stringify(us.data.wprefs)).catch(() => {});
    } else {
      trainerRef.current = localTrainer;
      prefsRef.current = { ...DEFAULT_WPREFS, ...(localPrefs ?? {}) };
    }
    trainerRef.current = withTrainerDefaults(trainerRef.current);
    setTrainerState(trainerRef.current);
    setWprefsState(prefsRef.current);
    const pn = await AsyncStorage.getItem(`reps:pinned:${uid}`);
    pinnedRef.current = { exercise: {}, routine: {}, ...(safe(pn) ?? {}) };
    pinDirtyRef.current = new Set(asList(safe(await AsyncStorage.getItem(`reps:pinned-dirty:${uid}`).catch(() => null))));
    // o banco é a fonte: o que existe lá vence o cache, MENOS o que mudou no aparelho e não chegou lá (pendente: o aparelho vence, inclusive apagar)
    const pnr = await supabase.from('pinned_notes').select('scope,key,texts');
    if (!pnr.error) {
      type Pins = { exercise: Record<string, string[]>; routine: Record<string, string[]> };
      const remote: Pins = { exercise: {}, routine: {} };
      pnr.data.forEach((r: any) => { remote[r.scope as 'exercise' | 'routine'][r.key] = r.texts; });
      const local = pinnedRef.current, dirtySet = new Set(pinDirtyRef.current);
      const merged: Pins = { exercise: { ...remote.exercise }, routine: { ...remote.routine } };
      // notas de antes da tabela (só no aparelho) sobem uma vez; depois disso, o que só existe aqui sem marca foi apagado em outro aparelho
      const migrated = !!(await AsyncStorage.getItem(`reps:pinned-migrated:${uid}`).catch(() => null));
      const ups: { user_id: string; scope: 'exercise' | 'routine'; key: string; texts: string[] }[] = [];
      const dels: { scope: 'exercise' | 'routine'; key: string }[] = [];
      if (!migrated) (['exercise', 'routine'] as const).forEach((scope) => Object.entries(local[scope]).forEach(([key, texts]) => {
        if (!remote[scope][key] && !dirtySet.has(`${scope}|${key}`)) { merged[scope][key] = texts; ups.push({ user_id: uid, scope, key, texts }); }
      }));
      dirtySet.forEach((tid) => {
        const cut = tid.indexOf('|'), scope = tid.slice(0, cut) as 'exercise' | 'routine', key = tid.slice(cut + 1);
        if (scope !== 'exercise' && scope !== 'routine') return;
        const texts = asList(local[scope][key]);
        if (texts.length) { merged[scope][key] = texts; ups.push({ user_id: uid, scope, key, texts }); } else { delete merged[scope][key]; dels.push({ scope, key }); }
      });
      pinnedRef.current = merged;
      AsyncStorage.setItem(`reps:pinned:${uid}`, JSON.stringify(merged)).catch(() => {});
      // tira a marca só do que o banco confirmou e não foi mexido de novo enquanto isso
      // o que foi enviado por chave: se a nota mudou depois (nova edição ainda não confirmada), a marca fica
      const sentOf: Record<string, string> = {};
      ups.forEach((u) => { sentOf[`${u.scope}|${u.key}`] = JSON.stringify(u.texts); });
      dels.forEach((d) => { sentOf[`${d.scope}|${d.key}`] = 'null'; });
      const curPin = (t: string) => { const cut = t.indexOf('|'), sc = t.slice(0, cut) as 'exercise' | 'routine'; return JSON.stringify(pinnedRef.current[sc]?.[t.slice(cut + 1)] ?? null); };
      const confirm = (tids: string[]) => {
        if (uidRef.current !== uid) return;
        tids.forEach((t) => { if (!pinTimers.current[t] && !pinRuns.current[t] && curPin(t) === sentOf[t]) pinDirtyRef.current.delete(t); });
        savePinDirty(uid, pinDirtyRef.current);
      };
      if (ups.length) supabase.from('pinned_notes').upsert(ups, { onConflict: 'user_id,scope,key' }).then((r) => {
        if (r.error) return;
        if (!migrated) AsyncStorage.setItem(`reps:pinned-migrated:${uid}`, '1').catch(() => {});
        confirm(ups.map((u) => `${u.scope}|${u.key}`).filter((t) => dirtySet.has(t)));
      }, () => {});
      else if (!migrated) AsyncStorage.setItem(`reps:pinned-migrated:${uid}`, '1').catch(() => {});
      dels.forEach(({ scope, key }) => supabase.from('pinned_notes').delete().eq('user_id', uid).eq('scope', scope).eq('key', key).then((r) => { if (!r.error) confirm([`${scope}|${key}`]); }, () => {}));
    }
    setError(null);
    setLoadFailed(false);
    setOffline(false);
  }, []);

  useEffect(() => {
    // Troca de usuário (entrar, sair, outra conta): some com os dados do anterior e mostra o carregamento até a carga do novo terminar.
    // Antes `ready` ficava true: quem já tinha conta caía no onboarding por alguns segundos (e um toque em Continue gravava o perfil vazio por cima do real)
    // e a cópia local era salva vazia. Renovação do token (mesmo usuário) não muda nada.
    const apply = (s: Session | null) => {
      const uid = s?.user.id ?? null;
      if (uid !== uidRef.current) {
        uidRef.current = uid;
        setExercises([]); setWorkouts([]); setRoutines([]); setMeasurements([]); setProfile(EMPTY_PROFILE); trainerRef.current = null; setTrainerState(null); activeRef.current = null; setActiveState(null);
        prefsRef.current = DEFAULT_WPREFS; setWprefsState(DEFAULT_WPREFS); pinnedRef.current = { exercise: {}, routine: {} }; pinDirtyRef.current = new Set(); setRest(null);
        setOffline(false); setLoadFailed(false); setPendingCount(0);
        // saindo: nada para carregar, a tela de entrada aparece já; entrando: o carregamento fica até a carga liberar
        setReady(!uid);
      }
      setSession(s);
    };
    supabase.auth.getSession().then(async ({ data, error: e }) => {
      if (data.session) return apply(data.session);
      // sem internet e com o token vencido o supabase responde "sem sessão" (mas ela continua guardada): abre com a cópia do aparelho
      if (e && isAuthRetryableFetchError(e)) {
        const stored = await readStoredSession();
        if (stored) { offlineAuthRef.current = true; return apply(stored); }
      }
      apply(null); setReady(true);
    }, () => { apply(null); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'INITIAL_SESSION') return; // a sessão inicial vem do getSession acima
      if (offlineAuthRef.current) {
        if (!s && ev !== 'SIGNED_OUT') return; // sessão do aparelho (offline): só sair de verdade derruba
        offlineAuthRef.current = false;
        // a renovação deu certo quando a internet voltou: troca pela sessão real e carrega do servidor (a cópia local continua na tela)
        if (s && s.user.id === uidRef.current) { setSession(s); setReloadTick((n) => n + 1); return; }
      }
      apply(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Carrega os dados do servidor quando o usuário entra (busca assíncrona).
    if (!userId) return;
    const uid = userId, stale = () => uidRef.current !== uid;
    // sessão do aparelho com token vencido (sem internet): vai direto para a cópia local, sem pedir nada ao servidor
    (offlineAuthRef.current ? Promise.reject(new Error('Network request failed (offline session)')) : load(uid, session?.user.email ?? 'user'))
      .catch(async (e) => {
        if (stale()) return;
        // sem internet: abre com a cópia da última carga (e os treinos que estão na fila); sem cópia, mostra "tentar de novo"
        const net = isNetworkError(e);
        if (!net) reportError(e, { where: 'load' });
        const snap = net ? await readSnapshot(uid) : null;
        if (stale()) return;
        if (!snap) { setError(String(e?.message ?? e)); setLoadFailed(true); return; }
        const queued = (await readOutbox(uid)).map((p) => p.workout);
        const safe = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
        const lt = safe(await AsyncStorage.getItem(`reps:trainer:${uid}`).catch(() => null));
        const lp = safe(await AsyncStorage.getItem(`reps:wprefs:${uid}`).catch(() => null));
        const pn = safe(await AsyncStorage.getItem(`reps:pinned:${uid}`).catch(() => null));
        const pd = safe(await AsyncStorage.getItem(`reps:pinned-dirty:${uid}`).catch(() => null));
        if (stale()) return;
        exRef.current = snap.exercises;
        setExercises(snap.exercises); setProfile(snap.profile); setRoutines(snap.routines); setMeasurements(snap.measurements);
        setWorkouts(mergePending(queued, snap.workouts));
        setPendingCount(queued.length);
        trainerRef.current = withTrainerDefaults(lt);
        prefsRef.current = { ...DEFAULT_WPREFS, ...(lp ?? {}) };
        pinnedRef.current = { exercise: {}, routine: {}, ...(pn ?? {}) };
        pinDirtyRef.current = new Set(asList(pd));
        setTrainerState(trainerRef.current); setWprefsState(prefsRef.current);
        setError(null); setLoadFailed(false); setOffline(true);
      })
      .finally(() => { if (!stale()) setReady(true); });
  }, [userId, session?.user.email, load, reloadTick]);

  // App indo para o fundo: envia já as notas fixadas que esperavam a digitação parar (a marca de pendente cobre se o app for fechado)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') Object.entries(pinRuns.current).forEach(([tid, run]) => { clearTimeout(pinTimers.current[tid]); run(); });
    });
    return () => sub.remove();
  }, []);

  /** Cria no banco os exercícios do catálogo usados (`cat:<id>`) e devolve os ids reais. Com erro, devolve os ids como vieram + o erro. */
  const ensureChain = useRef<Promise<unknown>>(Promise.resolve());
  const ensureRaw = useCallback((ids: string[]): Promise<{ ids: string[]; error: { message: string } | null }> => {
    const run = async () => {
      const have = new Map(exRef.current.filter((e) => e.catalogId).map((e) => [e.catalogId!, e.id]));
      const missing = [...new Set(ids.filter((id) => id.startsWith('cat:')).map((id) => id.slice(4)).filter((cid) => !have.has(cid)))];
      if (missing.length) {
        const cols = 'id,name,muscle,equipment,kind,catalog_id';
        const toEx = (r: any): Exercise => { const c = CAT_BY_ID.get(r.catalog_id); return { id: r.id, name: c?.n ?? r.name, muscle: c?.m ?? r.muscle, equipment: c?.e ?? r.equipment, kind: (c?.k ?? r.kind) as Exercise['kind'], catalogId: r.catalog_id }; };
        // pode já existir no banco (criado em outro aparelho, ou a resposta se perdeu): usa o que existe e cria só o resto
        const found = await supabase.from('exercises').select(cols).in('catalog_id', missing);
        if (found.error) return { ids, error: found.error };
        const added: Exercise[] = found.data.map(toEx);
        added.forEach((a) => have.set(a.catalogId!, a.id));
        const rows = missing.filter((cid) => !have.has(cid)).flatMap((cid) => { const c = CAT_BY_ID.get(cid); return c ? [{ name: c.n, muscle: c.m, equipment: c.e, kind: c.k, catalog_id: cid }] : []; });
        if (rows.length) {
          const { data, error: e } = await supabase.from('exercises').insert(rows).select(cols);
          if (e) return { ids, error: e };
          data.map(toEx).forEach((a) => { added.push(a); have.set(a.catalogId!, a.id); });
        }
        exRef.current = [...exRef.current.filter((x) => !added.some((a) => a.id === x.id)), ...added];
        added.forEach((a) => duringLoad.current.exercises.add(a.id));
        setExercises(exRef.current);
      }
      return { ids: ids.map((id) => (id.startsWith('cat:') ? have.get(id.slice(4)) ?? id : id)), error: null };
    };
    // uma por vez: duas chamadas juntas (fila + salvar treino) tentavam criar o mesmo exercício
    const p = ensureChain.current.then(run, run);
    ensureChain.current = p.catch(() => {});
    return p;
  }, []);
  const ensure = useCallback(async (ids: string[]): Promise<string[]> => {
    const r = await ensureRaw(ids);
    if (r.error) fail(r.error.message);
    return r.ids;
  }, [ensureRaw, fail]);

  /** Toda mudança na fila de envio passa por aqui, uma de cada vez (senão uma gravação apaga a outra). */
  const outboxChain = useRef<Promise<unknown>>(Promise.resolve());
  const withOutbox = useCallback(<T,>(fn: (list: PendingWorkout[]) => Promise<T>) => {
    const run = async () => fn(userId ? await readOutbox(userId) : []);
    const p = outboxChain.current.then(run, run);
    outboxChain.current = p.catch(() => {});
    return p;
  }, [userId]);
  /** Envia os treinos da fila (salvos sem internet), um a um e na ordem. Sem rede, para; erro do servidor marca o treino como falho
   * e segue com os outros (ele tenta de novo na próxima carga do app). */
  const flushing = useRef(false);
  const flushOutbox = useCallback(async () => {
    // sessão do aparelho (token vencido, sem internet): espera a renovação; enviar agora daria erro de permissão
    if (!userId || flushing.current || offlineAuthRef.current) return;
    flushing.current = true;
    try {
      const tried = new Set<string>();
      for (;;) {
        const item = (await readOutbox(userId)).find((x) => !x.failed && !tried.has(x.workout.id));
        if (!item) break;
        tried.add(item.workout.id);
        const { workout: w, fromTrainer } = item;
        const uniq = [...new Set(w.entries.map((e) => e.exerciseId))];
        const r = await ensureRaw(uniq);
        const idMap = new Map(uniq.map((id, k) => [id, r.ids[k]]));
        const entries = w.entries.map((e) => ({ ...e, exerciseId: idMap.get(e.exerciseId) ?? e.exerciseId }));
        const err = r.error ?? await saveWorkoutRpc({ id: w.id, date: w.date, title: w.title, description: w.description, durationSec: w.durationSec, visibility: w.visibility, routineId: w.routineId ?? null, location: w.location ?? null, fromTrainer }, entries)
          .then((x) => x.error, (x) => x as { message: string });
        if (err && isNetworkError(err)) break;
        if (err) reportError(err, { where: 'outbox' });
        // a fila pode ter mudado durante o envio (treino novo, edição, exclusão): mexe só neste item
        const outcome = await withOutbox(async (list) => {
          const k = list.findIndex((x) => x.workout.id === w.id);
          if (k < 0) return 'deleted';
          if (JSON.stringify(list[k]) !== JSON.stringify(item)) return 'changed';
          const next = err ? list.map((x, n) => (n === k ? { ...x, failed: err.message } : x)) : list.filter((_, n) => n !== k);
          await writeOutbox(userId, next);
          setPendingCount(next.length);
          return err ? 'failed' : 'sent';
        });
        if (outcome === 'sent') duringLoad.current.saved.add(w.id);
        if (outcome === 'sent') setWorkouts((l) => l.map((x) => (x.id === w.id ? { ...w, entries, pending: undefined, uploadError: undefined } : x)));
        // recusado pelo servidor: o cartão avisa (antes ficava "Waiting to upload" para sempre, sem explicação)
        if (outcome === 'failed') setWorkouts((l) => l.map((x) => (x.id === w.id ? { ...x, uploadError: err?.message ?? 'error' } : x)));
        // apagado enquanto subia: apaga também no servidor; editado: sobe a versão nova na próxima volta
        if (outcome === 'deleted' && !err) {
          const d = await supabase.from('workouts').delete().eq('id', w.id).then((x) => x.error, (x) => x as { message: string });
          // não deu para apagar agora (a internet caiu): guarda para apagar na próxima carga, senão o treino voltava
          if (d) await writeDeletes(userId, [...new Set([...(await readDeletes(userId)), w.id])]);
        }
        if (outcome === 'changed') tried.delete(w.id);
      }
    } finally { flushing.current = false; }
  }, [userId, ensureRaw, withOutbox]);
  /** Coloca (ou substitui) um treino na fila. */
  const enqueue = useCallback((p: PendingWorkout) => withOutbox(async (list) => {
    if (!userId) return;
    const next = [...list.filter((x) => x.workout.id !== p.workout.id), p];
    await writeOutbox(userId, next);
    setPendingCount(next.length);
  }), [userId, withOutbox]);

  // Tenta voltar a falar com o servidor e enviar a fila: ao abrir/voltar ao app e a cada 30 s enquanto estiver offline ou houver fila.
  useEffect(() => {
    if (!userId || !ready || (!offline && !pendingCount)) return;
    const tick = async () => {
      if (offline) {
        const ping = await supabase.from('profiles').select('user_id').limit(1).then((x) => x.error, (x) => x);
        if (!ping) setReloadTick((n) => n + 1);
        return;
      }
      flushOutbox();
    };
    tick();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') tick(); });
    const id = setInterval(tick, 30000);
    return () => { sub.remove(); clearInterval(id); };
  }, [userId, ready, offline, pendingCount, flushOutbox]);

  // Cópia local dos dados (para abrir sem internet). Treinos da fila ficam fora: eles vivem no outbox.
  useEffect(() => {
    if (!userId || !ready || loadFailed) return;
    const t = setTimeout(() => saveSnapshot(userId, { profile, exercises, workouts: workouts.filter((w) => !w.pending), routines, measurements }), 1500);
    return () => clearTimeout(t);
  }, [userId, ready, loadFailed, profile, exercises, workouts, routines, measurements]);

  const allExercises = useMemo<Exercise[]>(() => {
    const byCat = new Map(exercises.filter((e) => e.catalogId).map((e) => [e.catalogId!, e]));
    // nome do catálogo no idioma da interface
    const fromCatalog = CATALOG.map((c) => { const e = byCat.get(c.id); if (!e) return catToExercise(c); const n = catName(c); return e.name === n ? e : { ...e, name: n }; });
    return [...fromCatalog, ...exercises.filter((e) => !e.catalogId)];
    // `lang` não aparece no corpo: `catName` lê o idioma atual, e o memo precisa refazer quando ele muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, lang]);

  const lookup = useMemo(() => {
    const m = new Map<string, Exercise>();
    allExercises.forEach((e) => { m.set(e.id, e); if (e.catalogId) m.set(`cat:${e.catalogId}`, e); });
    // as estatísticas (lib/stats) consultam o tipo e o id canônico por aqui
    setExerciseLookup((id) => m.get(id));
    return m;
  }, [allExercises]);

  const allExRef = useRef<Exercise[]>([]);
  const startRef = useRef<(opts?: { routine?: Routine | null; entries?: SavedEntry[]; title?: string; trainerUid?: string }) => void>(() => {});
  const persistTrainer = useCallback((p: TrainerProgram | null) => {
    trainerRef.current = p;
    setTrainerState(p);
    if (userId) {
      (p ? AsyncStorage.setItem(`reps:trainer:${userId}`, JSON.stringify(p)) : AsyncStorage.removeItem(`reps:trainer:${userId}`)).catch(() => {});
      pushState('trainer');
    }
  }, [userId, pushState]);

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
    loadFailed, offline, pendingCount, reload: () => {
      // sessão do aparelho (token vencido, abriu sem internet): tenta renovar antes, senão a carga nem chega ao servidor
      if (!offlineAuthRef.current) return setReloadTick((n) => n + 1);
      supabase.auth.refreshSession().then(({ data }) => {
        if (data.session && data.session.user.id === uidRef.current) { offlineAuthRef.current = false; setSession(data.session); }
      }, () => {}).finally(() => setReloadTick((n) => n + 1));
    }, ready, session, error, toast, profile, exercises, workouts, routines, measurements, active, rest, showToast, allExercises,
    ensureExercises: ensure,
    findExercise: (id) => lookup.get(id),
    wprefs,
    setWprefs: (patch) => { prefsRef.current = { ...prefsRef.current, ...patch }; setWprefsState(prefsRef.current); if (userId) { AsyncStorage.setItem(`reps:wprefs:${userId}`, JSON.stringify(prefsRef.current)).catch(() => {}); pushState('wprefs'); } },
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
    completePasswordReset: async (email, code, password) => {
      const v = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' });
      if (v.error) return v.error.message;
      // o verifyOtp já entra na conta e a tela de login some: o resultado da senha nova vai pelo toast da raiz
      const u = await supabase.auth.updateUser({ password });
      if (u.error) { await supabase.auth.signOut().catch(() => {}); showToast(u.error.message, 5000); return u.error.message; }
      showToast('Password updated. You are signed in.', 3500);
      return null;
    },
    signOut: async () => {
      track('logout');
      // sem internet o "sair" padrão (revoga no servidor) falhava calado e a pessoa continuava dentro: sai pelo menos deste aparelho
      const g = await supabase.auth.signOut().catch((x) => ({ error: x as { message: string } }));
      if (g.error) {
        const l = await supabase.auth.signOut({ scope: 'local' }).catch((x) => ({ error: x as { message: string } }));
        if (l.error) { fail(l.error.message); return; }
      }
      // lembretes só saem depois de sair de fato (antes sumiam mesmo quando o sair falhava)
      await cancelReminders();
    },
    deleteAccount: async () => {
      const uid = userId;
      const r = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (r.error || r.data?.error) return r.data?.error ?? r.error?.message ?? 'Could not delete the account.';
      track('account_deleted');
      await cancelReminders();
      if (uid) await AsyncStorage.multiRemove(['reps:active:', 'reps:trainer:', 'reps:wprefs:', 'reps:pinned:', 'reps:pinned-dirty:', 'reps:pinned-migrated:', 'reps:dirty:', 'reps:deletes:', 'reps:report-dismissed:', 'reps:cache:', 'reps:outbox:'].map((k) => k + uid)).catch(() => {});
      await AsyncStorage.removeItem('reps:exassets').catch(() => {});
      await supabase.auth.signOut().catch(() => {});
      return null;
    },

    saveProfile: async (patch) => {
      const prev = profile;
      const next = { ...profile, ...patch };
      // otimista (a tela muda na hora), menos o `onboarded`: ele troca o onboarding pelas abas, então só vale depois de gravar
      const first = !!patch.onboarded && !prev.onboarded;
      setProfile((cur) => ({ ...cur, ...patch, ...(first ? { onboarded: cur.onboarded } : {}) }));
      const { error: e } = await supabase.from('profiles').upsert({
        user_id: userId!, username: next.username, display_name: next.displayName, bio: next.bio, link: next.link, sex: next.sex, birth_year: next.birthYear,
        weight_kg: next.weightKg, units: next.units, theme: next.theme, is_private: next.isPrivate, onboarded: next.onboarded,
      });
      if (e) {
        // não gravou (nome de usuário em uso, sem internet...): volta o que este pedido mudou, se ninguém mudou depois
        const keys = Object.keys(patch) as (keyof Profile)[];
        setProfile((cur) => ({ ...cur, ...Object.fromEntries(keys.filter((k) => cur[k] === next[k]).map((k) => [k, prev[k]])) }));
        fail(e.message);
        return false;
      }
      if (first) {
        setProfile((cur) => ({ ...cur, onboarded: true }));
        // onboarding concluído pela primeira vez: pede o e-mail de boas-vindas (o servidor só envia uma vez e só se o Resend estiver configurado)
        supabase.functions.invoke('send-email', { body: { type: 'welcome' } }).then(() => {}, () => {});
      }
      return true;
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
      duringLoad.current.exercises.add(row.id);
      setExercises((l) => [...l, row]);
      return row;
    },
    updateExercise: async (id, x) => {
      const { error: e } = await supabase.from('exercises').update({ name: x.name.trim(), muscle: x.muscle, equipment: x.equipment, kind: x.kind, target: x.target ?? null, secondary_muscles: x.secondary ?? [] }).eq('id', id);
      if (e) { fail(e.message); return false; }
      const map = JSON.parse((await AsyncStorage.getItem('reps:exassets').catch(() => null)) ?? '{}');
      if (x.assetUri) map[id] = x.assetUri; else delete map[id];
      AsyncStorage.setItem('reps:exassets', JSON.stringify(map)).catch(() => {});
      setExercises((l) => l.map((r) => (r.id === id ? { ...r, name: x.name.trim(), muscle: x.muscle, equipment: x.equipment, kind: x.kind, target: x.target ?? null, secondary: x.secondary ?? [], assetUri: x.assetUri ?? null } : r)));
      return true;
    },
    removeExercise: async (id) => {
      const { error: e } = await supabase.from('exercises').delete().eq('id', id);
      if (e) return fail(e.message);
      setExercises((l) => l.filter((x) => x.id !== id));
      // o banco apaga em cascata o histórico dele: tira também dos treinos, das rotinas e do treino em andamento
      setWorkouts((l) => l.map((w) => (w.entries.some((x) => x.exerciseId === id) ? { ...w, entries: w.entries.filter((x) => x.exerciseId !== id) } : w)));
      setRoutines((l) => l.map((r) => (r.exercises.some((x) => x.exerciseId === id) ? { ...r, exercises: r.exercises.filter((x) => x.exerciseId !== id) } : r)));
      if (activeRef.current?.entries.some((x) => x.exerciseId === id)) setActive((a) => ({ ...a, entries: a.entries.filter((x) => x.exerciseId !== id) }));
    },

    startWorkout: (opts) => {
      const src = opts?.entries ?? opts?.routine?.exercises ?? [];
      const entries: ActiveEntry[] = src.map((e) => ({
        uid: randomUUID(), unit: e.unit, exerciseId: e.exerciseId, ...noteFields(startNotes(e.exerciseId, e.notes ?? '', opts)), restSec: e.restSec ?? 0, superset: e.superset ?? null,
        sets: (e.sets.length ? e.sets : ([{ type: 'normal', kg: null, reps: null }] as SetRow[])).map((s, j): ActiveSet => {
          // campos vazios/zerados vêm preenchidos com o que foi feito da última vez
          const last = lastSetsOf(e.exerciseId, opts?.routine?.id);
          const p = last.length ? last[Math.min(j, last.length - 1)] : null;
          return p && (!s.kg || s.reps == null) ? { ...s, kg: s.kg || p.kg, reps: s.reps ?? p.reps, seconds: s.seconds ?? p.seconds, distM: s.distM ?? p.distM, done: false } : { ...s, done: false };
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
      const p = trainerRef.current, w = p?.workouts.find((x) => x.uid === tuid);
      if (!p || !w) return;
      // semana leve (deload, depois das semanas do ciclo): metade das séries e o peso da última vez, sem aumentar
      const deload = !!p.settings.deload && p.completed >= p.settings.frequency * CYCLE_WEEKS;
      const entries: SavedEntry[] = w.exercises.map((e) => {
        const last = lastSetsOf(e.exerciseId), work = last.filter((s) => s.type !== 'warmup'), unit = lastUnitOf(e.exerciseId);
        const base = deload && work.length ? work.map((s) => ({ kg: s.kg, reps: s.reps })) : suggestSets(last, e, lookup.get(e.exerciseId)?.equipment ?? '', unit ?? profile.units.weight) ?? Array.from({ length: e.sets }, () => ({ kg: null, reps: e.repMax }));
        const sets = deload ? base.slice(0, Math.max(1, Math.ceil(e.sets / 2))) : base;
        // a progressão segue a unidade do exercício (lbs: degraus de 5 lb) e o treino abre nela
        return { unit, exerciseId: e.exerciseId, notes: '', restSec: e.restSec, superset: null, sets: sets.map((x) => ({ type: 'normal' as const, kg: x.kg, reps: x.reps })) };
      });
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
      return { uid: randomUUID(), exerciseId: id, ...noteFields(pins), restSec: prefsRef.current.defaultRestSec, sets: last.length ? last.map((p): ActiveSet => ({ type: p.type, kg: p.kg, reps: p.reps, seconds: p.seconds, distM: p.distM, done: false })) : [newSet()] };
    })] })),
    removeEntry: (i) => setActive((a) => ({ ...a, entries: a.entries.filter((_, k) => k !== i) })),
    routinePins: (routineId, exerciseId) => readPins('routine', exerciseId, routineId),
    setRoutinePins: (routineId, exerciseId, texts) => writePins('routine', exerciseId, routineId, texts.filter((x) => x.trim())),
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
      if (list.find((n) => n.id === id)?.kind !== 'workout') syncPins(e, list, a.fromRoutineId);
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
      const gone = notesOf(e).find((n) => n.id === id), list = notesOf(e).filter((n) => n.id !== id);
      setActive((cur) => ({ ...cur, entries: cur.entries.map((x, k) => (k === i ? { ...x, ...noteFields(list) } : x)) }));
      if (gone && gone.kind !== 'workout') syncPins(e, list, a.fromRoutineId);
    },
    moveEntry: (from, to) => setActive((a) => { const list = [...a.entries]; const [it] = list.splice(from, 1); list.splice(to, 0, it); return { ...a, entries: list }; }),
    swapEntry: (i, id) => setActive((a) => {
      const e = a.entries[i];
      if (!e || e.exerciseId === id) return a;
      const original = e.swappedFrom ?? e.exerciseId;
      const last = lastSetsOf(id, a.fromRoutineId);
      // séries ainda não feitas passam a usar o histórico do novo exercício (ou ficam sem peso, para não herdar o do outro)
      const fresh = (s: ActiveSet, j: number): ActiveSet => {
        const p = last.length ? last[Math.min(j, last.length - 1)] : null;
        return p ? { ...s, kg: p.kg, reps: p.reps ?? s.reps, seconds: p.seconds, distM: p.distM, typed: false } : { ...s, kg: null, seconds: null, distM: null, typed: false };
      };
      const swapped = (from: ActiveEntry, sets: ActiveSet[]): ActiveEntry => ({ ...e, ...noteFields(notesFor(id, from, a.fromRoutineId)), exerciseId: id, swappedFrom: id === original ? undefined : original, madeMain: undefined, sets });
      // já tem série feita: ela é do exercício atual e fica com ele (senão ia para o histórico e os recordes do outro);
      // o novo entra logo abaixo com as séries que faltam (as notas do treino ficam só no atual, para não gravar duas vezes)
      // desfazer (voltar ao original) uma troca que dividiu o exercício e ainda sem série feita no novo: junta de volta na parte que ficou
      const k = e.uid ? a.entries.findIndex((x) => x.splitTo === e.uid) : -1;
      if (id === original && k >= 0 && a.entries[k].exerciseId === id && !e.sets.some((s) => s.done)) {
        const kept = a.entries[k];
        const merged: ActiveEntry = { ...kept, splitTo: undefined, sets: [...kept.sets, ...e.sets.map((s, j) => fresh(s, kept.sets.length + j))] };
        return { ...a, entries: a.entries.flatMap((x, n) => (n === i ? [] : n === k ? [merged] : [x])) };
      }
      if (e.sets.some((s) => s.done)) {
        const todo = e.sets.filter((s) => !s.done);
        const next: ActiveEntry = { ...swapped({ ...e, ...noteFields([]) }, (todo.length ? todo : [newSet()]).map(fresh)), uid: randomUUID() };
        return { ...a, entries: [...a.entries.slice(0, i), { ...e, splitTo: next.uid, sets: e.sets.filter((s) => s.done) }, next, ...a.entries.slice(i + 1)] };
      }
      return { ...a, entries: a.entries.map((x, k) => (k === i ? swapped(e, e.sets.map(fresh)) : x)) };
    }),
    // Replace é troca de verdade: o estado do Swap (original, "virou principal") não passa para o exercício novo
    replaceEntry: (i, exerciseId) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, ...noteFields(notesFor(exerciseId, e, a.fromRoutineId)), exerciseId, swappedFrom: undefined, splitTo: undefined, madeMain: undefined } : e)) })),
    patchEntry: (i, patch) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, ...patch } : e)) })),
    addSet: (i) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: [...e.sets, { ...newSet(), kg: e.sets.at(-1)?.kg ?? null, reps: e.sets.at(-1)?.reps ?? null, seconds: e.sets.at(-1)?.seconds ?? null, distM: e.sets.at(-1)?.distM ?? null }] } : e)) })),
    patchSet: (i, j, patch) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: e.sets.map((s, n) => (n === j ? { ...s, ...patch } : s)) } : e)) })),
    removeSet: (i, j) => setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: e.sets.filter((_, n) => n !== j) } : e)) })),
    toggleSet: (i, j) => {
      const cur = activeRef.current?.entries[i];
      if (!cur) return;
      const willBeDone = !cur.sets[j].done;
      setActive((a) => ({ ...a, entries: a.entries.map((e, k) => (k === i ? { ...e, sets: e.sets.map((s, n) => (n === j ? { ...s, done: willBeDone } : s)) } : e)) }));
      if (willBeDone && prefsRef.current.livePR) {
        const rec = records(wkRef.current, (cur.exerciseId.startsWith('cat:') ? exRef.current.find((e) => e.catalogId === cur.exerciseId.slice(4))?.id ?? cur.exerciseId : cur.exerciseId));
        if (prFlags(rec, cur.sets.map((s, n) => (n === j ? { ...s, done: true } : s)), lookup.get(cur.exerciseId)?.kind)[j]) { showToast('New personal record!'); playSound('sfx_record', prefsRef.current.prVolume); }
      }
      if (willBeDone) playSound('sfx_check', prefsRef.current.checkVolume);
      if (willBeDone) track('set_completed', { type: cur.sets[j].type, has_weight: (cur.sets[j].kg ?? 0) > 0 });
      if (willBeDone && cur.restSec > 0) setRest({ endsAt: Date.now() + cur.restSec * 1000, total: cur.restSec });
    },
    pauseToggle: () => setActive((a) => a.pausedAt
      ? { ...a, pausedMs: a.pausedMs + (Date.now() - new Date(a.pausedAt).getTime()), pausedAt: null }
      : { ...a, pausedAt: new Date().toISOString() }),
    setStartTime: (iso) => setActive((a) => ({ ...a, dateAt: iso })),
    completeTypedSets: () => setActive((a) => ({ ...a, entries: a.entries.map((e) => (e.hidden ? e : { ...e, sets: e.sets.map((s) => (!s.done && s.typed && setHasValue(s) ? { ...s, done: true } : s)) })) })),
    setElapsed: (sec) => setActive((a) => ({ ...a, pausedMs: 0, pausedAt: a.pausedAt ? new Date().toISOString() : null, startedAt: new Date(Date.now() - sec * 1000).toISOString() })),
    discardActive: () => { track('workout_discarded'); setActive(() => null); setRest(null); },
    finishActive: async (meta) => {
      const a = activeRef.current;
      if (!a) return null;
      const entries: SavedEntry[] = a.entries
        .filter((e) => !e.hidden)
        .map((e) => ({ unit: e.unit, exerciseId: e.exerciseId, notes: workoutText(notesOf(e)), restSec: e.restSec, superset: e.superset ?? null, sets: e.sets.filter((s) => s.done).map(({ done: _d, typed: _t, ...s }) => s) }))
        .filter((e) => e.sets.length > 0);
      if (!entries.length) { fail('Complete at least one set to save the workout.'); return null; }
      const uniq = [...new Set(entries.map((e) => e.exerciseId))];
      // sessão do aparelho (token vencido, sem internet): vai direto para a fila; o servidor recusaria por permissão
      const r = offlineAuthRef.current ? { ids: uniq, error: { message: 'Network request failed (offline session)' } } : await ensureRaw(uniq);
      if (r.error && !isNetworkError(r.error)) { reportError(r.error, { where: 'save-workout' }); fail(r.error.message); return null; }
      const idMap = new Map(uniq.map((id, k) => [id, r.ids[k]]));
      entries.forEach((e) => { e.exerciseId = idMap.get(e.exerciseId) ?? e.exerciseId; });
      const err = r.error ?? await saveWorkoutRpc({ id: a.id, date: meta.date, title: meta.title || 'Workout', description: meta.description, durationSec: meta.durationSec, visibility: meta.visibility, routineId: a.fromRoutineId ?? null, location: meta.location || null, fromTrainer: !!a.fromTrainer }, entries)
        .then((x) => x.error, (x) => x as { message: string });
      if (err && !isNetworkError(err)) { reportError(err, { where: 'save-workout' }); fail(err.message); return null; }
      const saved: Workout = { id: a.id, date: meta.date, title: meta.title || 'Workout', description: meta.description, durationSec: meta.durationSec, visibility: meta.visibility, entries, routineId: a.fromRoutineId ?? null, location: meta.location || null };
      // sem internet: o treino fica no aparelho e sobe sozinho quando a conexão voltar
      if (a.fromTrainer) saved.fromTrainer = true;
      if (err) { saved.pending = true; await enqueue({ workout: saved, fromTrainer: !!a.fromTrainer }); showToast('Saved on this device. It will upload when you are back online.', 4000); }
      if (a.fromTrainer) advanceTrainer(a.fromTrainer);
      track('workout_finished', {
        source: a.fromTrainer ? 'trainer' : a.fromRoutineId ? 'routine' : 'empty', duration_min: Math.round(meta.durationSec / 60),
        exercises: entries.length, sets: entries.reduce((t, e) => t + e.sets.length, 0), visibility: meta.visibility, has_location: !!meta.location,
        workouts_total: wkRef.current.length + 1,
      });
      duringLoad.current.saved.add(saved.id);
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
      if (old.pending) {
        // ainda na fila: só troca a versão que vai subir
        const next: Workout = { ...old, title: patch.title || 'Workout', description: patch.description, date: patch.date, visibility: patch.visibility, location: patch.location || null, durationSec: patch.durationSec, entries: patch.entries.map((e) => ({ ...e, sets: e.sets.filter(setHasValue) })).filter((e) => e.sets.length > 0) };
        if (!next.entries.length) { fail('A workout needs at least one set.'); return false; }
        await enqueue({ workout: next, fromTrainer: !!old.fromTrainer });
        setWorkouts((l) => l.map((w) => (w.id === id ? next : w)).sort((a, b) => +new Date(b.date) - +new Date(a.date)));
        return true;
      }
      const entries = patch.entries.map((e) => ({ ...e, sets: e.sets.filter(setHasValue) })).filter((e) => e.sets.length > 0);
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
      if (wkRef.current.find((w) => w.id === id)?.pending && userId) {
        await withOutbox(async (list) => { const next = list.filter((x) => x.workout.id !== id); await writeOutbox(userId, next); setPendingCount(next.length); });
        duringLoad.current.deleted.add(id);
        setWorkouts((l) => l.filter((w) => w.id !== id));
        return;
      }
      const { error: e } = await supabase.from('workouts').delete().eq('id', id);
      if (e) return fail(e.message);
      duringLoad.current.deleted.add(id);
      setWorkouts((l) => l.filter((w) => w.id !== id));
    },

    saveRoutine: async (r) => {
      const uniq = [...new Set(r.exercises.map((e) => e.exerciseId))];
      const ens = await ensureRaw(uniq);
      if (ens.error) { fail(ens.error.message); return null; }
      const idMap = new Map(uniq.map((id, k) => [id, ens.ids[k]]));
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
      const prev = m.id ? measurements.find((x) => x.id === m.id) : undefined;
      let path: string | null = null;
      if (m.photoUri && prev?.photoUri === m.photoUri) path = prev.photoPath ?? null;
      // a URL assinada falhou ao carregar (sem photoUri, mas com photoPath): a foto continua lá, não é "foto removida"
      else if (!m.photoUri && prev?.photoPath && !prev.photoUri) path = prev.photoPath;
      const keepLocal = m.photoUri && !path && /^https?:/.test(m.photoUri) ? m.photoUri : null;
      let uploaded: string | null = null;
      if (m.photoUri && !path && !keepLocal) {
        // foto nova: sobe para o bucket privado do próprio usuário
        try {
          const bytes = await (await fetch(m.photoUri)).arrayBuffer();
          const p = `${userId}/${randomUUID()}.jpg`;
          const up = await supabase.storage.from('progress-photos').upload(p, bytes, { contentType: 'image/jpeg' });
          if (up.error) { fail(up.error.message); return false; }
          path = uploaded = p;
        } catch { fail('Could not upload the photo. Check your connection.'); return false; }
      }
      const row = { measured_on: m.date, values: m.values, photo_uri: path ? `storage:${path}` : keepLocal };
      const q = m.id ? supabase.from('measurements').update(row).eq('id', m.id) : supabase.from('measurements').insert(row);
      const { data, error: e } = await q.select('id,measured_on,values,photo_uri').single();
      if (e) {
        // não gravou: a linha continua com a foto antiga; a nova que acabou de subir sai do Storage
        if (uploaded) supabase.storage.from('progress-photos').remove([uploaded]).then(() => {}, () => {});
        fail(e.message);
        return false;
      }
      // só depois de gravar: apaga do Storage a foto antiga que foi trocada ou removida
      if (prev?.photoPath && prev.photoPath !== path) supabase.storage.from('progress-photos').remove([prev.photoPath]).then(() => {}, () => {});
      const mm = await toMeasurement(data);
      setMeasurements((l) => [mm, ...l.filter((x) => x.id !== mm.id)].sort((a, b) => b.date.localeCompare(a.date)));
      return true;
    },
    deleteMeasurement: async (id) => {
      const gone = measurements.find((x) => x.id === id);
      const { error: e } = await supabase.from('measurements').delete().eq('id', id);
      if (e) { fail(e.message); return false; }
      if (gone?.photoPath) supabase.storage.from('progress-photos').remove([gone.photoPath]).then(() => {}, () => {});
      setMeasurements((l) => l.filter((x) => x.id !== id));
      return true;
    },

    sendFeedback: async (kind, body, ref) => {
      const { error: e } = await supabase.from('feedback').insert({ kind, body, ref });
      if (e) { fail(e.message); return false; }
      return true;
    },
  }), [loadFailed, offline, pendingCount, ensureRaw, enqueue, ready, session, error, toast, profile, exercises, workouts, routines, measurements, active, rest, userId, setActive, fail, showToast, allExercises, ensure, lookup, lastSetsOf, wprefs, trainer, persistTrainer, advanceTrainer, readPins, writePins, syncPins, startNotes, notesFor, withOutbox, lastUnitOf, pushState]);

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
    // atualiza já ao ligar (senão o primeiro intervalo mostrava o valor velho: cronômetro negativo por um instante)
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [intervalMs, enabled]);
  return now;
}
