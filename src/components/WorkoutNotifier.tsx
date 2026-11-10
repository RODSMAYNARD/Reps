import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { fmtClock, toDisplayWeight } from '../lib/format';
import { TIMER_SOUNDS, notificationSoundFile, playTimerSound } from '../lib/sounds';
import { useStore } from '../lib/store';
import { fmtSet } from '../lib/exerciseOptions';
import { tr, useLang } from '../lib/i18n';
import { ActiveWorkout, ExerciseKind, Units } from '../lib/types';

const LIVE = 'workout-live';
const REST_END = 'rest-end';
/**
 * Canais do Android. Os antigos (`workout`, `rest`, `rest-<som>`, `rest-silent`) usavam números crus de importância, mas o enum do
 * expo é deslocado (2 = NONE, 4 = LOW): o treino ficava bloqueado e o descanso sem som nem pop-up. O Android nunca sobe a importância
 * de um canal existente, então os ids mudaram (-v2) e os antigos são apagados uma vez.
 */
const CH_WORKOUT = 'workout-v2';
const CH_REST = 'rest-v2';
const OLD_CHANNELS = ['workout', 'rest', 'rest-silent', ...TIMER_SOUNDS.map((s) => `rest-${s.id}`)];
let oldChannelsDropped = false;
/** Canal do alarme de descanso: um por som (no Android o som é do canal); som desconhecido usa o som padrão do sistema. */
const restChannel = (audible: boolean, sound: string) => (!audible ? `${CH_REST}-silent` : TIMER_SOUNDS.some((s) => s.id === sound) ? `${CH_REST}-${sound}` : CH_REST);

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const bg = AppState.currentState !== 'active';
    return { shouldShowBanner: bg, shouldShowList: bg, shouldPlaySound: bg, shouldSetBadge: false };
  },
});

async function setup() {
  if (Platform.OS === 'android') {
    if (!oldChannelsDropped) { oldChannelsDropped = true; await Promise.all(OLD_CHANNELS.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => {}))); }
    // treino em andamento: LOW = aparece na barra, sem som nem pop-up
    await Notifications.setNotificationChannelAsync(CH_WORKOUT, { name: tr('Workout in progress'), importance: AndroidImportance.LOW, vibrationPattern: [0], showBadge: false });
    // fim do descanso: HIGH = pop-up com som
    await Notifications.setNotificationChannelAsync(CH_REST, { name: tr('Rest timer'), importance: AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 150, 250] });
    // um canal por som: no Android o som é do canal e não muda depois de criado
    for (const s of TIMER_SOUNDS) await Notifications.setNotificationChannelAsync(`${CH_REST}-${s.id}`, { name: `${tr('Rest timer:')} ${tr(s.label)}`, importance: AndroidImportance.HIGH, sound: notificationSoundFile(s.id), vibrationPattern: [0, 250, 150, 250] });
    await Notifications.setNotificationChannelAsync(`${CH_REST}-silent`, { name: tr('Rest timer (silent)'), importance: AndroidImportance.DEFAULT, sound: null, vibrationPattern: [0] });
  }
  await Notifications.setNotificationCategoryAsync('workout', [{ identifier: 'complete', buttonTitle: tr('Complete Set'), options: { opensAppToForeground: false } }]);
  await Notifications.setNotificationCategoryAsync('rest', [
    { identifier: 'skip', buttonTitle: tr('Skip'), options: { opensAppToForeground: false } },
    { identifier: 'minus15', buttonTitle: '-15s', options: { opensAppToForeground: false } },
    { identifier: 'plus15', buttonTitle: '+15s', options: { opensAppToForeground: false } },
  ]);
}

/** Primeira série ainda não feita: exercício, nº da série e valores. */
function nextSet(a: ActiveWorkout, u: Units, name: (id: string) => string | undefined, kindOf: (id: string) => ExerciseKind | undefined = () => undefined) {
  for (let i = 0; i < a.entries.length; i++) {
    const e = a.entries[i];
    if (e.hidden) continue;
    const j = e.sets.findIndex((s) => !s.done);
    if (j < 0) continue;
    const s = e.sets[j];
    const k = kindOf(e.exerciseId);
    // peso na unidade escolhida para o exercício (Weight Input), senão a do perfil
    const eu: Units = e.unit ? { ...u, weight: e.unit } : u;
    // texto vai direto ao sistema (fora do <Text>): traduz aqui
    const reps = ` ${tr('reps')}`;
    const val = !k || k === 'weight_reps' ? (s.kg ? `${Math.round(toDisplayWeight(s.kg, eu) * 10) / 10} ${eu.weight} x ${s.reps ?? 0}${reps}` : `${s.reps ?? 0}${reps}`) : fmtSet(s, k, eu).replace(/ reps$/, reps);
    return { i, j, title: name(e.exerciseId) ?? tr('Workout'), text: `${tr('Set')} ${j + 1}/${e.sets.length} - ${val}` };
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
  // idioma: refaz canais/botões e textos quando muda (o componente fica fora do Stack que remonta)
  const lang = useLang();

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
  }, [has, lang]);

  // responde aos botões da notificação
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const s = ref.current;
      const id = r.actionIdentifier;
      if (id === 'skip') s.skipRest();
      else if (id === 'minus15') s.adjustRest(-15);
      else if (id === 'plus15') s.adjustRest(15);
      else if (id === 'complete' && s.active) {
        const n = nextSet(s.active, s.profile.units, (x) => s.findExercise(x)?.name, (x) => s.findExercise(x)?.kind);
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
        const n = nextSet(active, profile.units, (x) => st.findExercise(x)?.name, (x) => st.findExercise(x)?.kind);
        const left = rest ? Math.max(0, Math.round((rest.endsAt - Date.now()) / 1000)) : 0;
        const resting = !!rest && left > 0;
        if (!alive) return;
        await Notifications.scheduleNotificationAsync({
          identifier: LIVE,
          content: {
            title: n?.title ?? active.title,
            subtitle: undefined,
            body: resting ? `${tr('Rest')} ${fmtClock(left)} · ${n ? `${tr('Next:')} ${n.text}` : tr('Last set done')}` : n ? n.text : tr('All sets done — tap to finish'),
            categoryIdentifier: resting ? 'rest' : n ? 'workout' : undefined,
            sticky: true,
            autoDismiss: false,
            priority: Notifications.AndroidNotificationPriority.LOW,
            data: { live: true },
          },
          trigger: Platform.OS === 'android' ? { channelId: CH_WORKOUT } : null,
        });
      } catch { /* ignore */ }
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => { bgRef.current = state !== 'active'; sync(); });
    return () => { alive = false; sub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rest, profile.units, lang]);

  // alarme de fim do descanso (o sistema entrega mesmo com o app fechado)
  useEffect(() => {
    Notifications.cancelScheduledNotificationAsync(REST_END).catch(() => {});
    if (!rest) return;
    const endsAt = rest.endsAt;
    // Fim do descanso com o app aberto (a notificação não toca): o som sai daqui e SÓ DEPOIS o descanso termina. A tela do treino não
    // encerra antes (encerrar antes cancelava este timer e o som). Sem Sounds/volume Off fica mudo; atrasado > 2 s (voltou do segundo
    // plano, a notificação já tocou) só encerra.
    const timer = setTimeout(() => {
      if (audible && AppState.currentState === 'active' && Date.now() - endsAt < 2000) playTimerSound(wprefs.timerSound, wprefs.timerVolume);
      if (ref.current.rest?.endsAt === endsAt) ref.current.skipRest();
    }, Math.max(0, endsAt - Date.now()));
    if (endsAt <= Date.now() + 1000) return () => clearTimeout(timer);
    const n = active ? nextSet(active, profile.units, (x) => st.findExercise(x)?.name, (x) => st.findExercise(x)?.kind) : null;
    Notifications.scheduleNotificationAsync({
      identifier: REST_END,
      content: { title: tr('Rest is over'), body: n ? `${n.title} — ${n.text}` : tr('Time for your next set.'), sound: audible ? notificationSoundFile(wprefs.timerSound) : undefined, data: { restEnd: true } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(rest.endsAt), channelId: restChannel(audible, wprefs.timerSound) },
    }).catch(() => {});
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest?.endsAt, audible, wprefs.timerSound, wprefs.timerVolume, lang]);

  // ao terminar/descartar o treino, limpa tudo
  useEffect(() => {
    if (active) return;
    Notifications.dismissNotificationAsync(LIVE).catch(() => {});
    Notifications.cancelScheduledNotificationAsync(REST_END).catch(() => {});
  }, [active]);

  return null;
}
