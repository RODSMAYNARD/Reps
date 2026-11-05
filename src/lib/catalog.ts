import raw from '../data/catalog.json';
import { Exercise, ExerciseKind } from './types';

/** Catálogo de exercícios embutido no app (texto do dataset MIT hasaneyldrm/exercises-dataset, traduzido). */
export type CatItem = { id: string; n: string; en: string; m: string; e: string; k: ExerciseKind; t: string; s: string[]; i: string[]; pt?: { n: string; i: string[] } };
export const CATALOG = raw as CatItem[];
export const CAT_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
export const CAT_BY_EN = new Map(CATALOG.map((c) => [c.en.toLowerCase(), c]));
export const catKey = (c: CatItem) => `cat:${c.id}`;

export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const catToExercise = (c: CatItem): Exercise => ({ id: catKey(c), name: c.n, muscle: c.m, equipment: c.e, kind: c.k, catalogId: c.id });

export function searchExercises(list: Exercise[], q: string, muscle: string, equipment: string): Exercise[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return list
    .filter((e) => {
      if (muscle !== 'all' && e.muscle !== muscle) return false;
      if (equipment !== 'all' && e.equipment !== equipment) return false;
      if (!terms.length) return true;
      const c = e.catalogId ? CAT_BY_ID.get(e.catalogId) : undefined;
      const hay = norm(e.name + ' ' + (c?.pt?.n ?? ''));
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Grupos musculares do filtro (alvo fino do catálogo quando existir). */
const target = (e: Exercise) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.t : undefined);
export const MUSCLE_FILTERS: { title: string; items: { id: string; label: string; icon: string; match: (e: Exercise) => boolean }[] }[] = [
  { title: 'Upper Body', items: [
    { id: 'abs', label: 'Abdominals', icon: 'body-outline', match: (e) => e.muscle === 'Abs' },
    { id: 'biceps', label: 'Biceps', icon: 'barbell-outline', match: (e) => e.muscle === 'Biceps' },
    { id: 'chest', label: 'Chest', icon: 'heart-outline', match: (e) => e.muscle === 'Chest' },
    { id: 'forearms', label: 'Forearms', icon: 'hand-left-outline', match: (e) => e.muscle === 'Forearms' },
    { id: 'lats', label: 'Lats', icon: 'triangle-outline', match: (e) => target(e) === 'Lats' },
    { id: 'lowerback', label: 'Lower Back', icon: 'swap-vertical-outline', match: (e) => target(e) === 'Spine' },
    { id: 'neck', label: 'Neck', icon: 'person-outline', match: (e) => target(e) === 'Levator scapulae' },
    { id: 'shoulders', label: 'Shoulders', icon: 'shirt-outline', match: (e) => e.muscle === 'Shoulders' },
    { id: 'traps', label: 'Traps', icon: 'chevron-up-outline', match: (e) => target(e) === 'Traps' },
    { id: 'triceps', label: 'Triceps', icon: 'barbell-outline', match: (e) => e.muscle === 'Triceps' },
    { id: 'upperback', label: 'Upper Back', icon: 'layers-outline', match: (e) => target(e) === 'Upper back' || (!target(e) && e.muscle === 'Back') },
  ] },
  { title: 'Lower Body', items: [
    { id: 'abductors', label: 'Abductors', icon: 'resize-outline', match: (e) => target(e) === 'Abductors' },
    { id: 'adductors', label: 'Adductors', icon: 'contract-outline', match: (e) => target(e) === 'Adductors' },
    { id: 'calves', label: 'Calves', icon: 'walk-outline', match: (e) => e.muscle === 'Calves' },
    { id: 'glutes', label: 'Glutes', icon: 'ellipse-outline', match: (e) => e.muscle === 'Glutes' },
    { id: 'hamstrings', label: 'Hamstrings', icon: 'footsteps-outline', match: (e) => e.muscle === 'Hamstrings' },
    { id: 'quads', label: 'Quadriceps', icon: 'fitness-outline', match: (e) => e.muscle === 'Quads' },
  ] },
  { title: 'Other', items: [
    { id: 'cardio', label: 'Cardio', icon: 'pulse-outline', match: (e) => e.muscle === 'Cardio' },
    { id: 'full', label: 'Full Body', icon: 'accessibility-outline', match: (e) => e.muscle === 'Full body' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', match: (e) => !MUSCLE_FILTERS.slice(0, 2).some((g) => g.items.some((i) => i.match(e))) && e.muscle !== 'Cardio' && e.muscle !== 'Full body' },
  ] },
];
export const EQUIPMENT_FILTERS: { id: string; label: string; icon: string; values: string[] }[] = [
  { id: 'none', label: 'None', icon: 'body-outline', values: ['Body weight'] },
  { id: 'barbell', label: 'Barbell', icon: 'remove-outline', values: ['Barbell'] },
  { id: 'dumbbell', label: 'Dumbbell', icon: 'barbell-outline', values: ['Dumbbell'] },
  { id: 'kettlebell', label: 'Kettlebell', icon: 'basketball-outline', values: ['Kettlebell'] },
  { id: 'machine', label: 'Machine', icon: 'grid-outline', values: ['Machine'] },
  { id: 'cable', label: 'Cable', icon: 'git-merge-outline', values: ['Cable'] },
  { id: 'band', label: 'Resistance Band', icon: 'reorder-two-outline', values: ['Band'] },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', values: ['Other'] },
];
const MUSCLE_BY_ID = new Map(MUSCLE_FILTERS.flatMap((g) => g.items).map((i) => [i.id, i]));

/** Busca + filtro de vários músculos e vários equipamentos (um músculo OU outro; um equipamento OU outro; os dois filtros E entre si). */
export function filterExercises(list: Exercise[], q: string, muscles: string[], equipment: string[]): Exercise[] {
  const eq = new Set(EQUIPMENT_FILTERS.filter((x) => equipment.includes(x.id)).flatMap((x) => x.values));
  const ms = muscles.map((id) => MUSCLE_BY_ID.get(id)).filter(Boolean) as { match: (e: Exercise) => boolean }[];
  const base = searchExercises(list, q, 'all', 'all');
  return base.filter((e) => (!ms.length || ms.some((m) => m.match(e))) && (!eq.size || eq.has(e.equipment)));
}
