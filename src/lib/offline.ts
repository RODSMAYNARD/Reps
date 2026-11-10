import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Exercise, Measurement, Profile, Routine, Workout } from './types';

/** Erro de rede (sem internet, servidor fora do ar, tempo esgotado), em vez de um erro de validação do servidor. */
export const isNetworkError = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e ?? '');
  return /network|fetch|timed? ?out|timeout|connection|offline|abort/i.test(m);
};

export const OFFLINE_MSG = "You're offline. Try again when you're connected.";

/** Cópia dos dados da última carga, usada quando o app abre sem internet. Guarda os treinos mais recentes (limite de tamanho do AsyncStorage). */
export type Snapshot = { profile: Profile; exercises: Exercise[]; workouts: Workout[]; routines: Routine[]; measurements: Measurement[] };
const CACHE_WORKOUTS = 300;

export const saveSnapshot = (uid: string, s: Snapshot) =>
  AsyncStorage.setItem(`reps:cache:${uid}`, JSON.stringify({ ...s, workouts: s.workouts.slice(0, CACHE_WORKOUTS) })).catch(() => {});

export const readSnapshot = async (uid: string): Promise<Snapshot | null> => {
  try { const raw = await AsyncStorage.getItem(`reps:cache:${uid}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

/** Treino salvo sem internet, esperando para subir. As entradas podem ter ids `cat:` (o exercício é criado no banco ao enviar). */
export type PendingWorkout = { workout: Workout; fromTrainer: boolean; failed?: string };
// `failed`: o servidor recusou (não é falta de rede); a fila segue com os outros e esse tenta de novo na próxima carga do app

export const readOutbox = async (uid: string): Promise<PendingWorkout[]> => {
  try { const raw = await AsyncStorage.getItem(`reps:outbox:${uid}`); return raw ? JSON.parse(raw) : []; } catch { return []; }
};

export const writeOutbox = (uid: string, list: PendingWorkout[]) =>
  (list.length ? AsyncStorage.setItem(`reps:outbox:${uid}`, JSON.stringify(list)) : AsyncStorage.removeItem(`reps:outbox:${uid}`)).catch(() => {});
