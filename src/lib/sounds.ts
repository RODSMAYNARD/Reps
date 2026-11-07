import type { SoundVolume, TimerSound } from './types';

/** Sons do app: todos gerados por `scripts/build-sounds.py` (originais, sem arquivos de terceiros). */
const FILES: Record<string, number> = {
  rest_default: require('../../assets/sounds/rest_default.wav'),
  rest_alarm: require('../../assets/sounds/rest_alarm.wav'),
  rest_futuristic: require('../../assets/sounds/rest_futuristic.wav'),
  rest_ting: require('../../assets/sounds/rest_ting.wav'),
  rest_boxing: require('../../assets/sounds/rest_boxing.wav'),
  rest_iron: require('../../assets/sounds/rest_iron.wav'),
  rest_marimba: require('../../assets/sounds/rest_marimba.wav'),
  rest_liftoff: require('../../assets/sounds/rest_liftoff.wav'),
  sfx_check: require('../../assets/sounds/sfx_check.wav'),
  sfx_record: require('../../assets/sounds/sfx_record.wav'),
};

/** Sons do alarme de fim do descanso, na ordem da tela. Os 3 últimos são criação própria do Reps. */
export const TIMER_SOUNDS: { id: TimerSound; label: string }[] = [
  { id: 'default', label: 'Default' }, { id: 'alarm', label: 'Alarm' }, { id: 'futuristic', label: 'Futuristic' }, { id: 'ting', label: 'Ting Ting' }, { id: 'boxing', label: 'Boxing Bell' },
  { id: 'iron', label: 'Iron Clink' }, { id: 'marimba', label: 'Rack Pop' }, { id: 'liftoff', label: 'Lift Off' },
];
/** Nome do arquivo na notificação (o plugin expo-notifications os copia para o app nativo; ver app.json). */
export const notificationSoundFile = (id: TimerSound) => `rest_${id}.wav`;

export const VOLUME_GAIN: Record<SoundVolume, number> = { high: 1, normal: 0.55, low: 0.25, off: 0 };

// expo-audio é módulo nativo: num app instalado antes dele, os sons ficam mudos (sem erro) até o build novo.
let audio: typeof import('expo-audio') | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { audio = require('expo-audio'); } catch { audio = null; }
const players = new Map<string, import('expo-audio').AudioPlayer>();
let modeSet = false;

/** Toca um som dentro do app (nome do arquivo sem extensão) no volume escolhido; Off não toca. */
export function playSound(key: string, volume: SoundVolume) {
  const gain = VOLUME_GAIN[volume];
  if (!audio || gain <= 0 || !FILES[key]) return;
  try {
    if (!modeSet) { modeSet = true; audio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {}); }
    let p = players.get(key);
    if (!p) { p = audio.createAudioPlayer(FILES[key]); players.set(key, p); }
    p.volume = gain;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch { /* sem som: segue o treino */ }
}

export const playTimerSound = (sound: TimerSound, volume: SoundVolume) => playSound(`rest_${sound}`, volume);
