import raw from '../data/catalog.json';
import { Exercise, ExerciseKind } from './types';

/** Catálogo de exercícios embutido no app (texto do dataset MIT hasaneyldrm/exercises-dataset, traduzido). */
export type CatItem = { id: string; n: string; en: string; m: string; e: string; k: ExerciseKind; t: string; s: string[]; i: string[]; l: 'pt' | 'en' };
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
      const hay = norm(e.name + ' ' + (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en ?? '' : ''));
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
