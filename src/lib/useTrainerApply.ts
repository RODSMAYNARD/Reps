import { CAT_BY_ID } from './catalog';
import { useStore } from './store';
import { generateProgram } from './trainer';
import { Exercise, TrainerProgram, TrainerSettings } from './types';

/** Regenera o programa com novas configurações. `restart` zera o progresso (Restart / Start New Program): semente nova e exercícios novos.
 * Sem `restart` (mudou um ajuste): mesma semente e mesmo ciclo, mantém os exercícios que ainda servem, a ordem da semana e o próximo treino. */
export function useTrainerApply() {
  const st = useStore();
  return (settings: TrainerSettings, restart = false): TrainerProgram | null => {
    const cur = st.trainer;
    if (!cur) return null;
    const enOf = (e: Exercise) => (e.catalogId ? CAT_BY_ID.get(e.catalogId)?.en : undefined);
    const gen = restart
      ? generateProgram(settings, st.allExercises, enOf, cur.seed + 1, cur.name, 1, cur)
      : generateProgram(settings, st.allExercises, enOf, cur.seed, cur.name, cur.cycle, cur, true);
    const next: TrainerProgram = { ...gen, id: cur.id, startedAt: restart ? new Date().toISOString() : cur.startedAt, completed: restart ? 0 : cur.completed };
    st.saveTrainer(next);
    return next;
  };
}
