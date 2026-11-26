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
/** Lista fixa de 30 dias, copiada do vídeo "Training plan" do app antigo (C B L S Ab A U F = foco, R = descanso). */
const CODE: Record<string, FocusId | null> = { C: 'chest', B: 'back', L: 'lower', S: 'shoulders', Ab: 'abs', A: 'arm', U: 'upper', F: 'full', R: null };
const fixed = (codes: string) => codes.trim().split(/\s+/).map((c) => CODE[c]);
export const GPLANS: GPlan[] = [
  { id: 'muscle', title: 'Muscle Building', icon: 'barbell', sub: 'Classic split, moderate reps', subPt: 'Divisão clássica, reps moderadas', tint: '#2F6BFF', sets: 4, reps: 8, restSec: 90, days: fixed('C B L R S Ab A R C B L R S Ab A R C B Ab R S L A R C B A R S L') },
  { id: 'stamina', title: 'Build Muscle Stamina', icon: 'kettlebell', sub: 'Lighter loads, more reps', subPt: 'Cargas leves, mais repetições', tint: '#F28A1E', sets: 3, reps: 15, restSec: 45, days: fixed('F U R F C R F B R L A R F U R F C R F B R L S R F U R F C B') },
  { id: 'strength', title: 'Strength Training', icon: 'rack', sub: 'Heavy sets of five', subPt: 'Séries pesadas de cinco', tint: '#F2405D', sets: 5, reps: 5, restSec: 150, days: cycle(['chest', 'back', 'lower', 'shoulders', 'arm', null, null]) },
  { id: 'sculpt', title: 'Body Sculpting', icon: 'ball', sub: 'Full variety, short rests', subPt: 'Muita variedade, descansos curtos', tint: '#8E5CF6', sets: 3, reps: 12, restSec: 60, days: fixed('C L A R Ab S R U C B R S F R U Ab A R B F R C L S R U F R B A') },
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
  /** Trocas feitas pelo botão Swap (`plano:dia` → { id novo: id original }), para o painel mostrar o original e desfazer. */
  swapped: Record<string, Record<string, string>>;
  /** Treino do plano em andamento: vira "dia concluído" quando o treino é salvo. */
  pending: { planId: string; day: number; at: string; workoutId?: string } | null;
};
const EMPTY: GState = { planId: 'muscle', done: {}, equipment: null, orm: 35, seeds: {}, custom: {}, swapped: {}, pending: null };

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

/** Gera exercícios por vagas (músculo, quantidade): clássicos do grupo filtrados pelo equipamento. `seed` > 0 embaralha
 * (Regenerate); sem semente gira pela vez `turn` (variação automática). Com 3+ vagas o básico principal fica e os acessórios giram. */
function slotExercises(s: GState, slots: [string, number][], seed: number, salt: number, turn: number, all: Exercise[], only?: Set<string>): Exercise[] {
  const allowed = only ?? allowedEquipment(gearOf(s));
  const byEn = new Map<string, Exercise>();
  all.forEach((e) => { const n = enOf(e); if (n) byEn.set(n.toLowerCase(), e); });
  const rand = rng(seed * 7919 + salt + 1);
  const out: Exercise[] = [];
  for (const [muscle, n] of slots) {
    const fits = (e: Exercise) => e.muscle === muscle && isRepKind(e.kind) && allowed.has(e.equipment) && !out.includes(e);
    const staples = (STAPLES[muscle] ?? []).flatMap((x) => byEn.get(x) ?? []).filter(fits);
    const extra = staples.length >= n ? [] : all.filter((e) => fits(e) && !staples.includes(e) && !NOISY.test((enOf(e) ?? e.name).toLowerCase())).slice(0, 12);
    const pool = [...staples, ...extra];
    if (seed) { out.push(...pool.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, n)); continue; }
    const anchor = n >= 3 && pool.length > n ? [pool[0]] : [];
    const rest = pool.slice(anchor.length);
    const k = n - anchor.length;
    const start = rest.length ? (turn * k) % rest.length : 0;
    out.push(...anchor, ...Array.from({ length: Math.min(k, rest.length) }, (_, i) => rest[(start + i) % rest.length]));
  }
  return out;
}

/** Exercícios do dia: lista editada à mão, senão gerada pelo foco, equipamento e semente (0 = clássicos do grupo girando a cada repetição do foco no plano). */
export function dayExercises(s: GState, planId: string, day: number, all: Exercise[], find: (id: string) => Exercise | undefined): Exercise[] {
  const focus = planOf(planId).days[day];
  if (!focus) return [];
  const key = dayKeyOf(planId, day);
  const custom = s.custom[key];
  if (custom) return custom.flatMap((id) => find(id) ?? []);
  // quantas vezes este foco já apareceu antes no plano: cada repetição gira os exercícios (variação automática)
  const turn = planOf(planId).days.slice(0, day).filter((f) => f === focus).length;
  return slotExercises(s, FOCUS[focus].slots, s.seeds[key] ?? 0, day, turn, all);
}

/** Entradas para iniciar o treino do dia. O 1RM do supino preenche a carga do supino com barra (Epley). */
export function dayEntries(s: GState, planId: string, list: Exercise[]): SavedEntry[] {
  return entriesFor(s, planOf(planId), list);
}
function entriesFor(s: GState, p: { sets: number; reps: number; restSec: number; setsOf?: Record<string, number> }, list: Exercise[]): SavedEntry[] {
  return list.map((e) => {
    const bench = e.equipment === 'Barbell' && /bench press/.test((enOf(e) ?? e.name).toLowerCase());
    const kg = bench && s.orm > 0 ? Math.max(20, Math.round(s.orm / (1 + p.reps / 30) / 2.5) * 2.5) : null;
    const n = p.setsOf?.[(enOf(e) ?? '').toLowerCase()] ?? p.sets;
    return { exerciseId: e.id, notes: '', restSec: p.restSec, superset: null, sets: Array.from({ length: n }, () => ({ type: 'normal' as const, kg, reps: p.reps })) };
  });
}

export const workoutTitle = (planId: string, day: number) => `${planOf(planId).title} · Day ${dayNumber(day)}`;

/** Treinos prontos da seção Treinos (pedido do Rodrigo, 2026-11-23, como no app antigo). Gerados pelas vagas (músculo, quantidade),
 * com Gerar de novo/Editar/Trocar como os dias do plano; o estado usa a chave `wk:<id>` nos mesmos `seeds`/`custom`/`swapped`.
 * Os de força têm lista fixa (nomes em inglês do catálogo) até a pessoa gerar de novo. "StrongLifts" é marca de outra empresa: aqui "Strength 5×5". */
export type PresetGroup = 'muscle' | 'region' | 'strength';
export type Preset = { id: string; title: string; group: PresetGroup; muscle: string; equip?: string; slots: [string, number][]; fixed?: string[]; setsOf?: Record<string, number>; sets: number; reps: number; restSec: number };
const P = (id: string, title: string, group: PresetGroup, muscle: string, slots: [string, number][], extra: Partial<Preset> = {}): Preset =>
  ({ id, title, group, muscle, slots, sets: 4, reps: 8, restSec: 90, ...extra });
export const PRESETS: Preset[] = [
  P('back', 'Back Workout', 'muscle', 'Traps', [['Back', 5]]),
  P('arm', 'Arm Workout', 'muscle', 'Biceps', [['Biceps', 3], ['Triceps', 3]]),
  P('abs', 'Abs Workout', 'muscle', 'Abdominals', [['Abs', 6]], { restSec: 60 }),
  P('shoulders', 'Shoulders Workout', 'muscle', 'Shoulders', [['Shoulders', 5]]),
  P('chest', 'Chest Workout', 'muscle', 'Chest', [['Chest', 5]]),
  P('glutes', 'Glutes Workout', 'muscle', 'Glutes', [['Glutes', 3], ['Hamstrings', 2], ['Quads', 1]]),
  P('upper', 'Upper Body Workout', 'region', 'Upper Back', [['Chest', 2], ['Back', 2], ['Shoulders', 2]]),
  P('lower', 'Lower Body Workout', 'region', 'Quadriceps', [['Quads', 3], ['Hamstrings', 2], ['Glutes', 1], ['Calves', 1]]),
  P('full', 'Full Body Workout', 'region', 'Full Body', [['Quads', 1], ['Chest', 1], ['Back', 1], ['Shoulders', 1], ['Hamstrings', 1], ['Biceps', 1], ['Abs', 1]]),
  P('vtaper', 'V-Taper Workout', 'region', 'Lats', [['Back', 3], ['Shoulders', 3]]),
  P('s5a', 'Strength 5×5 · A', 'strength', 'Quadriceps', [['Quads', 1], ['Chest', 1], ['Back', 1]], { equip: 'barbell', sets: 5, reps: 5, restSec: 150, fixed: ['barbell full squat', 'barbell bench press', 'barbell bent over row'] }),
  P('s5b', 'Strength 5×5 · B', 'strength', 'Hamstrings', [['Quads', 1], ['Shoulders', 1], ['Hamstrings', 1]], { equip: 'rack', sets: 5, reps: 5, restSec: 150, fixed: ['barbell full squat', 'barbell standing close grip military press', 'barbell deadlift'], setsOf: { 'barbell deadlift': 1 } }),
];
export const presetOf = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
export const presetKey = (id: string) => `wk:${id}`;
/** Quantos exercícios o treino pronto tem antes de qualquer edição (para a lista). */
export const presetCount = (p: Preset) => p.fixed?.length ?? p.slots.reduce((n, [, k]) => n + k, 0);

export function presetExercises(s: GState, id: string, all: Exercise[], find: (id: string) => Exercise | undefined): Exercise[] {
  const p = presetOf(id);
  const key = presetKey(id);
  const custom = s.custom[key];
  if (custom) return custom.flatMap((x) => find(x) ?? []);
  const seed = s.seeds[key] ?? 0;
  if (p.fixed && !seed) {
    const byEn = new Map<string, Exercise>();
    all.forEach((e) => { const n = enOf(e); if (n) byEn.set(n.toLowerCase(), e); });
    const list = p.fixed.flatMap((n) => byEn.get(n) ?? []);
    if (list.length === p.fixed.length) return list;
  }
  return slotExercises(s, p.slots, seed, PRESETS.indexOf(p) * 31, 0, all);
}
export const presetEntries = (s: GState, id: string, list: Exercise[]) => entriesFor(s, presetOf(id), list);
/** Séries de um exercício no treino pronto (ex.: terra 1×5 no Força 5×5 · B). */
export const presetSetsOf = (p: Preset, e: Exercise) => p.setsOf?.[(enOf(e) ?? '').toLowerCase()] ?? p.sets;

/** Treino montado sob pedido (Coach: "treino de peito de 40 min com halteres"): vagas por músculo, até `max` exercícios.
 * `equip` = só esses equipamentos do catálogo (ex.: ['Dumbbell']); sem ele vale o equipamento escolhido na aba Treinamento. */
export function buildWorkout(s: GState, slots: [string, number][], all: Exercise[], max: number, equip?: string[], seed = 1): Exercise[] {
  const only = equip?.length ? new Set(equip) : undefined;
  return slotExercises(s, slots, seed, 7, 0, all, only).slice(0, Math.max(1, max));
}
