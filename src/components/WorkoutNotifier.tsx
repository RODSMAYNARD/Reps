import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { fmtClock, toDisplayWeight } from '../lib/format';
import { TIMER_SOUNDS, notificationSoundFile, playTimerSound } from '../lib/sounds';
import { useStore } from '../lib/store';
import { ActiveWorkout, Units } from '../lib/types';

const LIVE = 'workout-live';
const REST_END = 'rest-end';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const bg = AppState.currentState !== 'active';
    return { shouldShowBanner: bg, shouldShowList: bg, shouldPlaySound: bg, shouldSetBadge: false };
  },
});

async function setup() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('workout', { name: 'Workout in progress', importance: 2 as Notifications.AndroidImportance, vibrationPattern: [0], showBadge: false });
    await Notifications.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: 4 as Notifications.AndroidImportance, sound: 'default', vibrationPattern: [0, 250, 150, 250] });
    // um canal por som: no Android o som é do canal e não muda depois de criado
    for (const s of TIMER_SOUNDS) await Notifications.setNotificationChannelAsync(`rest-${s.id}`, { name: `Rest timer: ${s.label}`, importance: 4 as Notifications.AndroidImportance, sound: notificationSoundFile(s.id), vibrationPattern: [0, 250, 150, 250] });
    await Notifications.setNotificationChannelAsync('rest-silent', { name: 'Rest timer (silent)', importance: 3 as Notifications.AndroidImportance, sound: null, vibrationPattern: [0] });
  }
  await Notifications.setNotificationCategoryAsync('workout', [{ identifier: 'complete', buttonTitle: 'Complete Set', options: { opensAppToForeground: false } }]);
  await Notifications.setNotificationCategoryAsync('rest', [
    { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: false } },
    { identifier: 'minus15', buttonTitle: '-15s', options: { opensAppToForeground: false } },
    { identifier: 'plus15', buttonTitle: '+15s', options: { opensAppToForeground: false } },
  ]);
}

/** Primeira série ainda não feita: exercício, nº da série e valores. */
function nextSet(a: ActiveWorkout, u: Units, name: (id: string) => string | undefined) {
  for (let i = 0; i < a.entries.length; i++) {
    const e = a.entries[i];
    if (e.hidden) continue;
    const j = e.sets.findIndex((s) => !s.done);
    if (j < 0) continue;
    const s = e.sets[j];
    const val = s.kg ? `${Math.round(toDisplayWeight(s.kg, u) * 10) / 10} ${u.weight} x ${s.reps ?? 0} reps` : `${s.reps ?? 0} reps`;
    return { i, j, title: name(e.exerciseId) ?? 'Workout', text: `Set ${j + 1}/${e.sets.length} - ${val}` };
  }
  return null;
}

/** Notificação do treino em andamento (fora do app) + aviso de fim do descanso. Sem UI. */
export function WorkoutNotifier() {
  const st = useStore();
  const { active, rest, profile, wprefs } = st;
  /** O alarme só toca com Sounds ligado e o volume do timer diferente de Off (volume e tipo do som exigem sons próprios: build novo). */
  const audible = wprefs.sounds && wprefs.timerVolume !== 'off';
  const ref = useRef(st);
  useEffect(() => { ref.current = st; });
  const ready = useRef(false);
  const bgRef = useRef(AppState.currentState !== 'active');

  // permissão + canais quando começa um treino
  const has = !!active;
  useEffect(() => {
    if (!has) return;
    (async () => {
      try {
        await setup();
        const cur = await Notifications.getPermissionsAsync();
        if (!cur.granted && cur.canAskAgain) await Notifications.requestPermissionsAsync();
        ready.current = true;
      } catch { /* sem notificações: o app segue normal */ }
    })();
  }, [has]);

  // responde aos botões da notificação
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const s = ref.current;
      const id = r.actionIdentifier;
      if (id === 'skip') s.skipRest();
      else if (id === 'minus15') s.adjustRest(-15);
      else if (id === 'plus15') s.adjustRest(15);
      else if (id === 'complete' && s.active) {
        const n = nextSet(s.active, s.profile.units, (x) => s.findExercise(x)?.name);
        if (n) s.toggleSet(n.i, n.j);
      }
    });
    return () => sub.remove();
  }, []);

  // atualiza a notificação ao sair do app, ao mudar o treino ou o descanso
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const bg = bgRef.current;
        if (!active || !bg) { await Notifications.dismissNotificationAsync(LIVE).catch(() => {}); return; }
        if (!ready.current) await setup();
        const n = nextSet(active, profile.units, (x) => st.findExercise(x)?.name);
        const left = rest ? Math.max(0, Math.round((rest.endsAt - Date.now()) / 1000)) : 0;
        const resting = !!rest && left > 0;
        if (!alive) return;
        await Notifications.scheduleNotificationAsync({
          identifier: LIVE,
          content: {
            title: n?.title ?? active.title,
            subtitle: undefined,
            body: resting ? `Rest ${fmtClock(left)} · ${n ? `Next: ${n.text}` : 'Last set done'}` : n ? n.text : 'All sets done — tap to finish',
            categoryIdentifier: resting ? 'rest' : n ? 'workout' : undefined,
            sticky: true,
            autoDismiss: false,
            priority: Notifications.AndroidNotificationPriority.LOW,
            data: { live: true },
          },
          trigger: Platform.OS === 'android' ? { channelId: 'workout' } : null,
        });
      } catch { /* ignore */ }
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => { bgRef.current = state !== 'active'; sync(); });
    return () => { alive = false; sub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rest, profile.units]);

  // alarme de fim do descanso (o sistema entrega mesmo com o app fechado)
  useEffect(() => {
    Notifications.cancelScheduledNotificationAsync(REST_END).catch(() => {});
    if (!rest || rest.endsAt <= Date.now() + 1000) return;
    const n = active ? nextSet(active, profile.units, (x) => st.findExercise(x)?.name) : null;
    Notifications.scheduleNotificationAsync({
      identifier: REST_END,
      content: { title: 'Rest is over', body: n ? `${n.title} — ${n.text}` : 'Time for your next set.', sound: audible ? notificationSoundFile(wprefs.timerSound) : undefined, data: { restEnd: true } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(rest.endsAt), channelId: audible ? `rest-${wprefs.timerSound}` : 'rest-silent' },
    }).catch(() => {});
    // com o app aberto a notificação não toca: o som sai daqui
    const timer = setTimeout(() => { if (AppState.currentState === 'active') playTimerSound(wprefs.timerSound, wprefs.timerVolume); }, rest.endsAt - Date.now());
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest?.endsAt, audible, wprefs.timerSound, wprefs.timerVolume]);

  // ao terminar/descartar o treino, limpa tudo
  useEffect(() => {
    if (active) return;
    Notifications.dismissNotificationAsync(LIVE).catch(() => {});
    Notifications.cancelScheduledNotificationAsync(REST_END).catch(() => {});
  }, [active]);

  return null;
}
