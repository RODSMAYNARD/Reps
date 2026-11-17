import { useEffect } from 'react';
import { tr } from '../lib/i18n';
import { takeNewWins, useChallenges } from '../lib/challenges';
import { useStore } from '../lib/store';

/** Avisa (uma vez por período) quando um treino salvo fecha um desafio. Os desafios são automáticos. */
export function ChallengeWatcher() {
  const { session, workouts, profile, showToast } = useStore();
  const ch = useChallenges(session?.user.id ?? null);
  useEffect(() => {
    if (!session) return;
    const won = takeNewWins(workouts, profile.units);
    if (won.length) showToast(`🏆 ${tr('Challenge completed')}: ${won.map((c) => tr(c.title)).join(', ')}`, 4000);
  }, [session, workouts, profile.units, ch, showToast]);
  return null;
}
