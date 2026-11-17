import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { IconName } from '../components/ui';
import { track } from './analytics';
import { LB, toDisplayWeight } from './format';
import { locale, tr } from './i18n';
import { dayKey, workoutSets, workoutVolume } from './stats';
import type { Units, Workout } from './types';

/**
 * Desafios AUTOMÁTICOS (sem "entrar"): cada um vale para um período de calendário (semana seg-dom ou mês)
 * e é calculado só a partir dos treinos salvos. Ao virar o período, recomeça sozinho.
 * Troféus = períodos passados em que a meta foi batida (também calculados dos treinos, nada guardado).
 * No aparelho fica só o que já foi comemorado (`reps:challenges:<uid>`), para o aviso aparecer uma vez.
 */
export type Metric = 'workouts' | 'streak' | 'volume' | 'sets' | 'early' | 'weekend';
export type Period = 'week' | 'month';
export type Challenge = { id: string; title: string; desc: string; icon: IconName; tint: string; period: Period; metric: Metric; target: number };

export const CHALLENGES: Challenge[] = [
  { id: 'week5', title: 'Perfect Week', desc: 'Complete 5 workouts this week.', icon: 'ribbon', tint: '#22B573', period: 'week', metric: 'workouts', target: 5 },
  { id: 'weekend', title: 'Weekend Warrior', desc: 'Train on Saturday and Sunday this week.', icon: 'trophy', tint: '#1E9BD7', period: 'week', metric: 'weekend', target: 2 },
  { id: 'month12', title: '12 Workouts', desc: 'Complete 12 workouts this month.', icon: 'calendar', tint: '#0A84FF', period: 'month', metric: 'workouts', target: 12 },
  { id: 'streak7', title: '7-Day Streak', desc: 'Train 7 days in a row this month.', icon: 'flame', tint: '#FF6B2C', period: 'month', metric: 'streak', target: 7 },
  // o alvo de volume é em kg; em lbs vira 100.000 lb (ver `targetOf`)
  { id: 'tons', title: 'Heavy Month', desc: '', icon: 'barbell', tint: '#8E5CF6', period: 'month', metric: 'volume', target: 50000 },
  { id: 'sets300', title: '300 Sets', desc: 'Log 300 sets this month.', icon: 'layers', tint: '#F2405D', period: 'month', metric: 'sets', target: 300 },
  { id: 'early', title: 'Early Bird', desc: 'Do 5 workouts that start before 8 a.m. this month.', icon: 'sunny', tint: '#F5B70A', period: 'month', metric: 'early', target: 5 },
];
export const challengeOf = (id: string) => CHALLENGES.find((c) => c.id === id);

const DAY = 86400000;
const num = (v: number) => Math.round(v).toLocaleString(locale());

/** Alvo na unidade do usuário (o de volume é um número redondo em kg ou em lb). */
export const targetOf = (c: Challenge, u: Units) => (c.metric === 'volume' && u.weight === 'lbs' ? 100000 / LB : c.target);

/** Descrição já traduzida (a de volume leva o número na unidade do usuário). */
export const challengeDesc = (c: Challenge, u: Units) =>
  c.metric === 'volume' ? `${tr('Lift a total of')} ${num(toDisplayWeight(targetOf(c, u), u))} ${u.weight} ${tr('this month.')}` : tr(c.desc);

/** Início e fim (exclusivo) do período que contém `at`; `back` = quantos períodos para trás. */
export function periodRange(p: Period, at = Date.now(), back = 0) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  if (p === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - back * 7); // segunda-feira
    const end = new Date(d); end.setDate(end.getDate() + 7);
    return { from: d.getTime(), to: end.getTime() };
  }
  d.setDate(1); d.setMonth(d.getMonth() - back);
  const end = new Date(d); end.setMonth(end.getMonth() + 1);
  return { from: d.getTime(), to: end.getTime() };
}

/** Chave do período (ex.: "2026-11" ou "w2026-11-16"), usada para comemorar uma vez só. */
export const periodKey = (p: Period, at = Date.now(), back = 0) => {
  const { from } = periodRange(p, at, back);
  return p === 'week' ? `w${dayKey(new Date(from))}` : dayKey(new Date(from)).slice(0, 7);
};

export type Progress = { value: number; target: number; pct: number; done: boolean; daysLeft: number };

function valueIn(c: Challenge, list: Workout[], from: number, to: number) {
  if (c.metric === 'workouts') return list.length;
  if (c.metric === 'sets') return list.reduce((a, w) => a + workoutSets(w), 0);
  if (c.metric === 'volume') return list.reduce((a, w) => a + workoutVolume(w), 0);
  if (c.metric === 'early') return list.filter((w) => new Date(w.date).getHours() < 8).length;
  if (c.metric === 'weekend') return new Set(list.filter((w) => [0, 6].includes(new Date(w.date).getDay())).map((w) => dayKey(w.date))).size;
  // maior sequência de dias seguidos com treino dentro do período
  const days = new Set(list.map((w) => dayKey(w.date)));
  let run = 0, best = 0;
  for (let t = from + DAY / 2; t < to; t += DAY) { run = days.has(dayKey(new Date(t))) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

/** Progresso do desafio no período atual (`back` = períodos anteriores). */
export function progressOf(c: Challenge, workouts: Workout[], u: Units, now = Date.now(), back = 0): Progress {
  const { from, to } = periodRange(c.period, now, back);
  const list = workouts.filter((w) => { const t = new Date(w.date).getTime(); return t >= from && t < to; });
  const value = valueIn(c, list, from, to);
  const target = targetOf(c, u);
  const done = value >= target;
  return { value, target, pct: Math.min(1, value / target), done, daysLeft: Math.max(0, Math.ceil((to - now) / DAY)) };
}

/** Quantos períodos passados (até 52 semanas / 24 meses) tiveram a meta batida. */
export function winsOf(c: Challenge, workouts: Workout[], u: Units, now = Date.now()) {
  if (!workouts.length) return 0;
  const first = Math.min(...workouts.map((w) => new Date(w.date).getTime()));
  let wins = 0;
  for (let b = 1; b <= (c.period === 'week' ? 52 : 24); b++) {
    if (periodRange(c.period, now, b).to <= first) break;
    if (progressOf(c, workouts, u, now, b).done) wins++;
  }
  return wins;
}

export const fmtProgress = (c: Challenge, p: Progress, u: Units) =>
  c.metric === 'volume' ? `${num(toDisplayWeight(p.value, u))} / ${num(toDisplayWeight(p.target, u))} ${u.weight}` : `${Math.floor(p.value)} / ${p.target}`;

export type CState = {
  /** Desafio → chave do período já comemorado (aviso "Desafio concluído" uma vez por período). */
  celebrated: Record<string, string>;
};
const EMPTY: CState = { celebrated: {} };

let uid: string | null = null;
let loaded = false;
let state: CState = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const save = (next: CState) => {
  state = next;
  emit();
  if (uid) AsyncStorage.setItem(`reps:challenges:${uid}`, JSON.stringify(state)).catch(() => {});
};

/** Estado dos desafios do usuário (carrega do aparelho quando o usuário muda). */
export function useChallenges(userId: string | null) {
  useEffect(() => {
    if (userId === uid) return;
    uid = userId; state = EMPTY; loaded = false; emit();
    if (!userId) return;
    AsyncStorage.getItem(`reps:challenges:${userId}`).then((raw) => {
      if (uid !== userId) return;
      // cópia antiga (com "joined") ou estragada: começa do zero
      try { const j = raw ? JSON.parse(raw) : null; state = { celebrated: j?.celebrated ?? {} }; } catch { state = EMPTY; }
      loaded = true; emit();
    }).catch(() => { loaded = true; emit(); });
  }, [userId]);
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

/**
 * Desafios concluídos no período atual que ainda não foram comemorados; marca como comemorados.
 * Na primeira vez (aparelho sem registro) só marca, sem avisar, para não soltar avisos antigos de uma vez.
 */
export function takeNewWins(workouts: Workout[], u: Units, now = Date.now()): Challenge[] {
  if (!uid || !loaded) return [];
  const fresh = Object.keys(state.celebrated).length === 0;
  const out: Challenge[] = [];
  const celebrated = { ...state.celebrated };
  for (const c of CHALLENGES) {
    const key = periodKey(c.period, now);
    if (celebrated[c.id] === key || !progressOf(c, workouts, u, now).done) continue;
    celebrated[c.id] = key;
    if (!fresh) { out.push(c); track('challenge_completed', { id: c.id, period: key }); }
  }
  if (Object.keys(celebrated).length !== Object.keys(state.celebrated).length || out.length || Object.keys(celebrated).some((k) => celebrated[k] !== state.celebrated[k])) save({ celebrated });
  return out;
}

export type ChallengeView = { c: Challenge; p: Progress; wins: number; status: 'active' | 'done' };

/** Lista para as telas: em andamento (mais perto de fechar primeiro), depois os concluídos no período. */
export function challengeViews(_s: CState, workouts: Workout[], u: Units): ChallengeView[] {
  return CHALLENGES.map((c): ChallengeView => {
    const p = progressOf(c, workouts, u);
    return { c, p, wins: winsOf(c, workouts, u), status: p.done ? 'done' : 'active' };
  }).sort((a, b) => (a.status === b.status ? b.p.pct - a.p.pct : a.status === 'active' ? -1 : 1));
}
