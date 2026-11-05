import { CAT_BY_ID } from './catalog';
import { useStore } from './store';
import { generateProgram } from './trainer';
import { Exercise, TrainerProgram, TrainerSettings } from './types';

/** Regenera o programa com novas configurações. `restart` zera o progresso (Start New Program). */
export function useTrainerApply() {
  const st = useStore();
  return (settings: TrainerSettings, restart = false): TrainerProgram | null => {
    const cur = st.trainer;
    if (!cur) return null;
    const enOf = (e: Exercise) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en : undefined);
    const gen = generateProgram(settings, st.allExercises, enOf, cur.seed + 1, cur.name, restart ? 1 : cur.cycle, cur);
    const next: TrainerProgram = { ...gen, id: cur.id, startedAt: restart ? new Date().toISOString() : cur.startedAt, completed: restart ? 0 : Math.min(cur.completed, 9999) };
    st.saveTrainer(next);
    return next;
  };
}
