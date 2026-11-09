import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncReminders } from '../lib/reminders';
import { useStore } from '../lib/store';

/** Reagenda os lembretes locais quando as preferências ou os treinos mudam e ao voltar para o app. */
export function ReminderSync() {
  const { ready, session, wprefs, workouts } = useStore();
  useEffect(() => {
    if (!ready || !session) return;
    const t = setTimeout(() => syncReminders(wprefs, workouts), 1000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') syncReminders(wprefs, workouts); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [ready, session, wprefs, workouts]);
  return null;
}
