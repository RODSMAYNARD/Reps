import type { ActiveEntry, EntryNote } from './types';

/** Notas do exercício no treino ativo. Treinos guardados antes das várias notas têm só `notes`/`noteKind`. */
export const notesOf = (e: ActiveEntry): EntryNote[] => e.noteList ?? (e.notes ? [{ id: 'n0', text: e.notes, kind: e.noteKind ?? 'workout' }] : []);

/** Texto das notas do treino (as fixadas não vão no post), uma por linha: é o que se grava no banco. */
export const workoutText = (list: EntryNote[]) => list.filter((n) => n.kind === 'workout' && n.text.trim()).map((n) => n.text.trim()).join('\n');

/** Campos da entrada que mudam juntos quando as notas mudam. */
export const noteFields = (list: EntryNote[]) => ({ noteList: list, notes: workoutText(list) });
