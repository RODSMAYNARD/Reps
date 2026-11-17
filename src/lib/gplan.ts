import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { Region } from '../components/BodyMap';
import type { GymIcon } from './gymIcons';
import { CAT_BY_ID } from './catalog';
import { getLang } from './i18n';
import { STAPLES, isRepKind } from './planner';
import { allowedEquipment, presetIds } from './trainer';
import type { Exercise, SavedEntry } from './types';

/** Aba G (em teste): planos de 30 dias com um treino gerado por dia. Tudo fica só no aparelho (`reps:gplan:<uid>`). */

export type FocusId = 'chest' | 'back' | 'lower' | 'shoulders' | 'abs' | 'arm' | 'upper' | 'full';
type FocusDef = { label: string; pt: string; slots: [string, number][]; regions: Region[]; side: 'front' | 'back' };
export const FOCUS: Record<FocusId, FocusDef> = {
  chest: { label: 'Chest', pt: 'Peito', slots: [['Chest', 5]], regions: ['chest'], side: 'front' },
  back: { label: 'Back', pt: 'Costas', slots: [['Back', 5]], regions: ['lats', 'upperback'], side: 'back' },
  lower: { label: 'Lower body', pt: 'Inferiores', slots: [['Quads', 2], ['Hamstrings', 1], ['Glutes', 1], ['Calves', 1]], regions: ['quads', 'adductors', 'calves'], side: 'front' },
  shoulders: { label: 'Shoulders', pt: 'Ombros', slots: [['Shoulders', 5]], regions: ['delts'], side: 'front' },
  abs: { label: 'Abs', pt: 'Abdômen', slots: [['Abs', 5]], regions: ['abs', 'obliques'], side: 'front' },
  arm: { label: 'Arm', pt: 'Braços', slots: [['Biceps', 3], ['Triceps', 2]], regions: ['biceps', 'forearms'], side: 'front' },
  upper: { label: 'Upper body', pt: 'Superiores', slots: [['Chest', 2], ['Back', 2], ['Shoulders', 1]], regions: ['chest', 'delts', 'biceps'], side: 'front' },
  full: { label: 'Full Body', pt: 'Corpo todo', slots: [['Quads', 1], ['Chest', 1], ['Back', 1], ['Shoulders', 1], ['Hamstrings', 1], ['Abs', 1]], regions: ['chest', 'delts', 'abs', 'quads'], side: 'front' },
};
/** Nome do foco no idioma do app ("Back" não pode passar pelo dicionário: lá ele é o botão Voltar). */
export const focusLabel = (f: FocusId) => (getLang() === 'pt' ? FOCUS[f].pt : FOCUS[f].label);

export type GPlan = { id: string; title: string; icon: GymIcon; sub?: string; subPt?: string; tint?: string; sets: number; reps: number; restSec: number; days: (FocusId | null)[] };
const cycle = (pattern: (FocusId | null)[]) => {
  const d = Array.from({ length: 30 }, (_, i) => pattern[i % pattern.length]);
  if (d[29] == null) d[29] = pattern.find((x) => x != null) ?? 'full'; // o plano não termina em descanso
  return d;
};
export const GPLANS: GPlan[] = [
  { id: 'muscle', title: 'Muscle Building', icon: 'barbell', sub: 'Classic split, moderate reps', subPt: 'Divisão clássica, reps moderadas', tint: '#2F6BFF', sets: 4, reps: 8, restSec: 90, days: cycle(['chest', 'back', 'lower', null, 'shoulders', 'abs', 'arm', null]) },
  { id: 'stamina', title: 'Build Muscle Stamina', icon: 'kettlebell', sub: 'Lighter loads, more reps', subPt: 'Cargas leves, mais repetições', tint: '#F28A1E', sets: 3, reps: 15, restSec: 45, days: cycle(['full', 'upper', null, 'full', 'lower', 'full', null]) },
  { id: 'strength', title: 'Strength Training', icon: 'rack', sub: 'Heavy sets of five', subPt: 'Séries pesadas de cinco', tint: '#F2405D', sets: 5, reps: 5, restSec: 150, days: cycle(['chest', 'back', 'lower', 'shoulders', 'arm', null, null]) },
  { id: 'sculpt', title: 'Body Sculpting', icon: 'ball', sub: 'Full variety, short rests', subPt: 'Muita variedade, descansos curtos', tint: '#8E5CF6', sets: 3, reps: 12, restSec: 60, days: cycle(['chest', 'lower', 'arm', null, 'abs', 'back', 'shoulders', null, 'upper', 'full']) },
  { id: 'beginner', title: 'Beginner Full Body', icon: 'dumbbell', sub: 'Three easy days a week', subPt: 'Três dias leves por semana', tint: '#22B573', sets: 3, reps: 10, restSec: 75, days: cycle(['full', null, 'full', null, 'full', null, null]) },
  { id: 'legs', title: 'Legs & Glutes', icon: 'legpress', sub: 'Lower body focus', subPt: 'Foco em pernas e glúteos', tint: '#1E9BD7', sets: 4, reps: 12, restSec: 75, days: cycle(['lower', null, 'abs', 'lower', null, 'full', null]) },
  { id: 'core', title: 'Core & Abs', icon: 'bodyweight', sub: 'Abs on most days', subPt: 'Abdômen na maioria dos dias', tint: '#E0A100', sets: 3, reps: 15, restSec: 45, days: cycle(['abs', 'full', null, 'abs', 'upper', 'abs', null]) },
];
/** Cor do plano (cartão, dia atual, boneco) e a frase curta no idioma do app. */
export const planTint = (p: GPlan) => p.tint ?? '#2F6BFF';
export const planSub = (p: GPlan) => (getLang() === 'pt' ? p.subPt ?? p.sub : p.sub) ?? '';
export const planOf = (id: string) => GPLANS.find((p) => p.id === id) ?? GPLANS[0];
/** Número mostrado no dia (os descansos ocupam o lugar, como "Day 1, 2, 3, Rest Day, Day 5"). */
export const dayNumber = (i: number) => i + 1;

export type GState = {
  planId: string;
  /** Dias concluídos por plano (= índice do dia atual). */
  done: Record<string, number>;
  /** Ids de equipamento do Trainer; `null` = padrão (academia comercial). */
  equipment: string[] | null;
  /** 1RM do supino, em kg. */
  orm: number;
  /** Quantas vezes o dia foi regenerado (`plano:dia`). */
  seeds: Record<string, number>;
  /** Lista editada à mão para o dia (`plano:dia` → ids dos exercícios). */
  custom: Record<string, string[]>;
  /** Treino do plano em andamento: vira "dia concluído" quando o treino é salvo. */
  pending: { planId: string; day: number; at: string; workoutId?: string } | null;
};
const EMPTY: GState = { planId: 'muscle', done: {}, equipment: null, orm: 35, seeds: {}, custom: {}, pending: null };

let uid: string | null = null;
let state: GState = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setG(patch: Partial<GState> | ((s: GState) => Partial<GState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
  if (uid) AsyncStorage.setItem(`reps:gplan:${uid}`, JSON.stringify(state)).catch(() => {});
}

/** Estado da aba G do usuário (carrega do aparelho quando o usuário muda). */
export function useG(userId: string | null) {
  useEffect(() => {
    if (userId === uid) return;
    uid = userId; state = EMPTY; emit();
    if (!userId) return;
    AsyncStorage.getItem(`reps:gplan:${userId}`).then((raw) => {
      if (uid !== userId || !raw) return;
      try { state = { ...EMPTY, ...JSON.parse(raw) }; emit(); } catch { /* cópia estragada: começa do zero */ }
    }).catch(() => {});
  }, [userId]);
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

export const dayKeyOf = (planId: string, day: number) => `${planId}:${day}`;
export const gearOf = (s: GState) => s.equipment ?? presetIds('commercial');

const enOf = (e: Exercise) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en : undefined);
const rng = (seed: number) => { let s = seed || 1; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); };
const NOISY = /\(2\)|assisted|stretch|\bpov\b|yoga|\bhold\b|v\. \d|male/;

/** Exercícios do dia: lista editada à mão, senão gerada pelo foco, equipamento e semente (0 = os clássicos do grupo, na ordem). */
export function dayExercises(s: GState, planId: string, day: number, all: Exercise[], find: (id: string) => Exercise | undefined): Exercise[] {
  const focus = planOf(planId).days[day];
  if (!focus) return [];
  const key = dayKeyOf(planId, day);
  const custom = s.custom[key];
  if (custom) return custom.flatMap((id) => find(id) ?? []);
  const allowed = allowedEquipment(gearOf(s));
  const byEn = new Map<string, Exercise>();
  all.forEach((e) => { const n = enOf(e); if (n) byEn.set(n.toLowerCase(), e); });
  const seed = s.seeds[key] ?? 0;
  const rand = rng(seed * 7919 + day + 1);
  const out: Exercise[] = [];
  for (const [muscle, n] of FOCUS[focus].slots) {
    const fits = (e: Exercise) => e.muscle === muscle && isRepKind(e.kind) && allowed.has(e.equipment) && !out.includes(e);
    const staples = (STAPLES[muscle] ?? []).flatMap((x) => byEn.get(x) ?? []).filter(fits);
    const extra = staples.length >= n ? [] : all.filter((e) => fits(e) && !staples.includes(e) && !NOISY.test((enOf(e) ?? e.name).toLowerCase())).slice(0, 12);
    const pool = [...staples, ...extra];
    // semente 0: os primeiros da lista; regenerado: embaralha e gira para não repetir o treino anterior
    const order = seed ? pool.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]) : pool;
    out.push(...order.slice(0, n));
  }
  return out;
}

/** Entradas para iniciar o treino do dia. O 1RM do supino preenche a carga do supino com barra (Epley). */
export function dayEntries(s: GState, planId: string, list: Exercise[]): SavedEntry[] {
  const p = planOf(planId);
  return list.map((e) => {
    const bench = e.equipment === 'Barbell' && /bench press/.test((enOf(e) ?? e.name).toLowerCase());
    const kg = bench && s.orm > 0 ? Math.max(20, Math.round(s.orm / (1 + p.reps / 30) / 2.5) * 2.5) : null;
    return { exerciseId: e.id, notes: '', restSec: p.restSec, superset: null, sets: Array.from({ length: p.sets }, () => ({ type: 'normal' as const, kg, reps: p.reps })) };
  });
}

export const workoutTitle = (planId: string, day: number) => `${planOf(planId).title} · Day ${dayNumber(day)}`;
