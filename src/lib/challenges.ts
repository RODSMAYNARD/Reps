import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { IconName } from '../components/ui';
import { track } from './analytics';
import { LB, toDisplayWeight } from './format';
import { locale, tr } from './i18n';
import { dayKey, workoutSets, workoutVolume } from './stats';
import type { Units, Workout } from './types';

/**
 * Desafios: metas com prazo, contadas sozinhas a partir dos treinos salvos desde o dia em que o usuário entrou.
 * A participação fica só no aparelho (`reps:challenges:<uid>`).
 */
export type Metric = 'workouts' | 'streak' | 'volume' | 'sets' | 'early' | 'weekend';
export type Challenge = { id: string; title: string; desc: string; icon: IconName; tint: string; days: number; metric: Metric; target: number };

export const CHALLENGES: Challenge[] = [
  { id: 'week5', title: 'Perfect Week', desc: 'Complete 5 workouts in 7 days.', icon: 'ribbon', tint: '#22B573', days: 7, metric: 'workouts', target: 5 },
  { id: 'streak7', title: '7-Day Streak', desc: 'Train 7 days in a row within 14 days.', icon: 'flame', tint: '#FF6B2C', days: 14, metric: 'streak', target: 7 },
  { id: 'month12', title: '12 Workouts in 30 Days', desc: 'Complete 12 workouts in 30 days.', icon: 'calendar', tint: '#0A84FF', days: 30, metric: 'workouts', target: 12 },
  // o alvo de volume é em kg; em lbs vira 100.000 lb (ver `targetOf`)
  { id: 'tons', title: 'Heavy Month', desc: '', icon: 'barbell', tint: '#8E5CF6', days: 30, metric: 'volume', target: 50000 },
  { id: 'sets300', title: '300 Sets', desc: 'Log 300 sets in 30 days.', icon: 'layers', tint: '#F2405D', days: 30, metric: 'sets', target: 300 },
  { id: 'early', title: 'Early Bird', desc: 'Do 5 workouts that start before 8 a.m. within 30 days.', icon: 'sunny', tint: '#F5B70A', days: 30, metric: 'early', target: 5 },
  { id: 'weekend', title: 'Weekend Warrior', desc: 'Train on 4 weekend days within 30 days.', icon: 'trophy', tint: '#1E9BD7', days: 30, metric: 'weekend', target: 4 },
];
export const challengeOf = (id: string) => CHALLENGES.find((c) => c.id === id);

const DAY = 86400000;
const num = (v: number) => Math.round(v).toLocaleString(locale());

/** Alvo na unidade do usuário (o de volume é um número redondo em kg ou em lb). */
export const targetOf = (c: Challenge, u: Units) => (c.metric === 'volume' && u.weight === 'lbs' ? 100000 / LB : c.target);

/** Descrição já traduzida (a de volume leva o número na unidade do usuário). */
export const challengeDesc = (c: Challenge, u: Units) =>
  c.metric === 'volume' ? `${tr('Lift a total of')} ${num(toDisplayWeight(targetOf(c, u), u))} ${u.weight} ${tr('in 30 days.')}` : tr(c.desc);

export type Progress = { value: number; target: number; pct: number; done: boolean; expired: boolean; daysLeft: number };

/** Quanto do desafio já foi feito desde `startISO` (só contam treinos dentro do prazo). */
export function progressOf(c: Challenge, startISO: string, workouts: Workout[], u: Units, now = Date.now()): Progress {
  const from = new Date(startISO).getTime();
  const to = from + c.days * DAY;
  const list = workouts.filter((w) => { const t = new Date(w.date).getTime(); return t >= from && t < to; });
  let value = 0;
  if (c.metric === 'workouts') value = list.length;
  else if (c.metric === 'sets') value = list.reduce((a, w) => a + workoutSets(w), 0);
  else if (c.metric === 'volume') value = list.reduce((a, w) => a + workoutVolume(w), 0);
  else if (c.metric === 'early') value = list.filter((w) => new Date(w.date).getHours() < 8).length;
  else if (c.metric === 'weekend') value = new Set(list.filter((w) => [0, 6].includes(new Date(w.date).getDay())).map((w) => dayKey(w.date))).size;
  else {
    // maior sequência de dias seguidos com treino dentro do prazo
    const days = new Set(list.map((w) => dayKey(w.date)));
    let run = 0;
    for (let i = 0; i < c.days; i++) {
      run = days.has(dayKey(new Date(from + i * DAY + DAY / 2))) ? run + 1 : 0;
      value = Math.max(value, run);
    }
  }
  const target = targetOf(c, u);
  const done = value >= target;
  return { value, target, pct: Math.min(1, value / target), done, expired: !done && now >= to, daysLeft: Math.max(0, Math.ceil((to - now) / DAY)) };
}

export const fmtProgress = (c: Challenge, p: Progress, u: Units) =>
  c.metric === 'volume' ? `${num(toDisplayWeight(p.value, u))} / ${num(toDisplayWeight(p.target, u))} ${u.weight}` : `${Math.floor(p.value)} / ${p.target}`;

export type CState = {
  /** Desafio → início (meia-noite do dia em que entrou, para o treino feito mais cedo no mesmo dia contar). */
  joined: Record<string, string>;
  /** Quantas vezes cada desafio já foi concluído e recomeçado. */
  wins: Record<string, number>;
};
const EMPTY: CState = { joined: {}, wins: {} };

let uid: string | null = null;
let state: CState = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const save = (next: CState) => {
  state = next;
  emit();
  if (uid) AsyncStorage.setItem(`reps:challenges:${uid}`, JSON.stringify(state)).catch(() => {});
};
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

export function joinChallenge(id: string) {
  track('challenge_joined', { id });
  save({ ...state, joined: { ...state.joined, [id]: todayStart() } });
}
export function leaveChallenge(id: string) {
  track('challenge_left', { id });
  const joined = { ...state.joined };
  delete joined[id];
  save({ ...state, joined });
}
/** Recomeça do zero; `won` = o anterior foi concluído (guarda o troféu). */
export function restartChallenge(id: string, won: boolean) {
  track('challenge_joined', { id, again: true });
  save({ joined: { ...state.joined, [id]: todayStart() }, wins: won ? { ...state.wins, [id]: (state.wins[id] ?? 0) + 1 } : state.wins });
}

/** Desafios do usuário (carrega do aparelho quando o usuário muda). */
export function useChallenges(userId: string | null) {
  useEffect(() => {
    if (userId === uid) return;
    uid = userId; state = EMPTY; emit();
    if (!userId) return;
    AsyncStorage.getItem(`reps:challenges:${userId}`).then((raw) => {
      if (uid !== userId || !raw) return;
      try { state = { ...EMPTY, ...JSON.parse(raw) }; emit(); } catch { /* cópia estragada: começa do zero */ }
    }).catch(() => {});
  }, [userId]);
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

export type ChallengeView = { c: Challenge; start: string | null; p: Progress | null; wins: number; status: 'active' | 'available' | 'done' | 'expired' };

/** Lista para as telas: em andamento primeiro, depois os disponíveis, os vencidos e os concluídos. */
export function challengeViews(s: CState, workouts: Workout[], u: Units): ChallengeView[] {
  const order = { active: 0, available: 1, expired: 2, done: 3 } as const;
  return CHALLENGES.map((c): ChallengeView => {
    const start = s.joined[c.id] ?? null;
    const p = start ? progressOf(c, start, workouts, u) : null;
    return { c, start, p, wins: s.wins[c.id] ?? 0, status: !p ? 'available' : p.done ? 'done' : p.expired ? 'expired' : 'active' };
  }).sort((a, b) => order[a.status] - order[b.status]);
}
