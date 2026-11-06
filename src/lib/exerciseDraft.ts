import { useSyncExternalStore } from 'react';
import { ExerciseKind } from './types';

/** Rascunho do exercício em criação, compartilhado entre a tela Create Exercise e as telas de escolha (equipamento, músculos, tipo). */
export type ExerciseDraft = { name: string; equipment: string | null; muscle: string | null; secondary: string[]; kind: ExerciseKind | null; assetUri: string | null };
export const EMPTY_DRAFT: ExerciseDraft = { name: '', equipment: null, muscle: null, secondary: [], kind: null, assetUri: null };

let draft: ExerciseDraft = EMPTY_DRAFT;
const subs = new Set<() => void>();
export const getDraft = () => draft;
export const patchDraft = (p: Partial<ExerciseDraft>) => { draft = { ...draft, ...p }; subs.forEach((f) => f()); };
export const resetDraft = () => { draft = EMPTY_DRAFT; subs.forEach((f) => f()); };
export const useDraft = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getDraft);
