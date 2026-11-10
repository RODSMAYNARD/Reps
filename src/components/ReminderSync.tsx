import { useEffect } from 'react';
import { AppState } from 'react-native';
import { cancelReminders, syncReminders } from '../lib/reminders';
import { useStore } from '../lib/store';
import { useLang } from '../lib/i18n';

/** Reagenda os lembretes locais quando as preferências, os treinos ou o idioma mudam e ao voltar para o app. Sem conta (saiu/apagou), cancela todos. */
export function ReminderSync() {
  const { ready, session, wprefs, workouts } = useStore();
  const lang = useLang(); // o texto das notificações é montado no idioma da hora de agendar
  useEffect(() => {
    if (!ready) return;
    if (!session) { cancelReminders(); return; }
    const t = setTimeout(() => syncReminders(wprefs, workouts), 1000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') syncReminders(wprefs, workouts); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [ready, session, wprefs, workouts, lang]);
  return null;
}
