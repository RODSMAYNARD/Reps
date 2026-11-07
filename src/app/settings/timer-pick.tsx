import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Header, ListRow, Screen } from '../../components/ui';
import { playSound, playTimerSound, TIMER_SOUNDS } from '../../lib/sounds';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { SoundVolume, TimerSound, WorkoutPrefs } from '../../lib/types';

export const SOUND_LABEL = Object.fromEntries(TIMER_SOUNDS.map((s) => [s.id, s.label])) as Record<TimerSound, string>;
export const VOLUME_LABEL: Record<SoundVolume, string> = { high: 'High', normal: 'Normal', low: 'Low', off: 'Off' };

type Key = 'timerSound' | 'timerVolume' | 'checkVolume' | 'prVolume';
const TITLES: Record<Key, string> = { timerSound: 'Select Timer Sound', timerVolume: 'Timer Sound Volume', checkVolume: 'Check Set Volume', prVolume: 'Live Personal Record Volume' };

/** Lista de opções com ✓ (som do timer ou volume). Escolher grava na hora e continua na tela, como no Hevy. */
export default function TimerPick() {
  const { key } = useLocalSearchParams<{ key: Key }>();
  const { wprefs, setWprefs } = useStore();
  const k: Key = key in TITLES ? key : 'timerVolume';
  const opts: { id: string; label: string }[] = k === 'timerSound'
    ? (Object.keys(SOUND_LABEL) as TimerSound[]).map((id) => ({ id, label: SOUND_LABEL[id] }))
    : (Object.keys(VOLUME_LABEL) as SoundVolume[]).map((id) => ({ id, label: VOLUME_LABEL[id] }));
  const current = wprefs[k] as string;
  return (
    <Screen>
      <Header title={TITLES[k]} />
      <View>
        {opts.map((o) => (
          <ListRow key={o.id} label={o.label} testID={`pick-${o.id}`} onPress={() => {
            setWprefs({ [k]: o.id } as Partial<WorkoutPrefs>);
            // ouvir ao escolher: o som novo, ou o som que o volume controla, já no volume novo
            if (k === 'timerSound') playTimerSound(o.id as TimerSound, wprefs.timerVolume === 'off' ? 'normal' : wprefs.timerVolume);
            else if (k === 'timerVolume') playTimerSound(wprefs.timerSound, o.id as SoundVolume);
            else playSound(k === 'checkVolume' ? 'sfx_check' : 'sfx_record', o.id as SoundVolume);
          }}
            right={current === o.id ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : <View style={{ width: 22 }} />} />
        ))}
      </View>
    </Screen>
  );
}
