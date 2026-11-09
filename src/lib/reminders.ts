import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getLang } from './i18n';
import type { Workout, WorkoutPrefs } from './types';

/**
 * Lembretes locais (notificações agendadas no próprio aparelho, sem servidor). Reagendados a cada abertura do app
 * e a cada treino salvo: datas fixas nos próximos 14 dias, então o lembrete do dia some quando você já treinou.
 */
const PREFIX = 'reps-rem-';
const DAY = 86400000;

const txt = (en: string, pt: string) => (getLang() === 'pt' ? pt : en);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** Segunda-feira 00:00 da semana de `d`. */
const weekStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export const remindersOn = (p: WorkoutPrefs) => p.remind || p.nudge || p.weeklyGoal > 0;

/** Pede a permissão de notificações (ao ligar um lembrete). Devolve se ficou permitido. */
export async function askReminderPermission() {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function syncReminders(p: WorkoutPrefs, workouts: Workout[]) {
  if (Platform.OS === 'web') return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!remindersOn(p) || !(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: txt('Reminders', 'Lembretes'), importance: 3 as Notifications.AndroidImportance });

    const now = new Date();
    const at = (d: Date) => { const x = new Date(d); x.setHours(p.remindHour, p.remindMin, 0, 0); return x; };
    const schedule = (id: string, date: Date, title: string, body: string) => date > now &&
      Notifications.scheduleNotificationAsync({ identifier: PREFIX + id, content: { title, body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'reminders' } });
    const trainedOn = (d: Date) => workouts.some((w) => sameDay(new Date(w.date), d));
    const jobs: (Promise<string> | false)[] = [];

    // 1) dias de treino escolhidos, no horário escolhido (pula o dia em que você já treinou)
    if (p.remind) {
      for (let i = 0; i < 14; i++) {
        const d = new Date(now.getTime() + i * DAY);
        if (!p.remindDays.includes(d.getDay()) || (i === 0 && trainedOn(d))) continue;
        jobs.push(schedule(`day-${i}`, at(d), txt('Time to train', 'Hora de treinar'), txt('Your workout is waiting. Open Reps and log it.', 'Seu treino está esperando. Abra o Reps e registre.')));
      }
    }
    // 2) sem treinar há 3 dias
    if (p.nudge) {
      const last = workouts.reduce((t, w) => Math.max(t, new Date(w.date).getTime()), 0);
      let when = at(new Date((last || now.getTime()) + 3 * DAY));
      if (when <= now) { when = at(now); if (when <= now) when = at(new Date(now.getTime() + DAY)); }
      jobs.push(schedule('nudge', when, txt('Missing the gym?', 'Saudade da academia?'), txt("It's been a few days since your last workout. A short session still counts.", 'Faz alguns dias desde o último treino. Um treino curto também conta.')));
    }
    // 3) meta semanal: na sexta, quanto falta
    if (p.weeklyGoal > 0) {
      const ws = weekStart(now);
      const done = new Set(workouts.filter((w) => new Date(w.date) >= ws).map((w) => new Date(w.date).toDateString())).size;
      const left = p.weeklyGoal - done;
      const fri = at(new Date(ws.getTime() + 4 * DAY));
      if (left > 0) jobs.push(schedule('goal', fri, txt('Weekly goal', 'Meta da semana'),
        txt(`${done} of ${p.weeklyGoal} workouts done. ${left} to go this week.`, `${done} de ${p.weeklyGoal} treinos feitos. Faltam ${left} nesta semana.`)));
    }
    await Promise.all(jobs);
  } catch {
    // sem módulo nativo / sem permissão: os lembretes ficam desligados sem erro
  }
}
