import { Text, View } from 'react-native';
import { Header, ListRow, Screen } from '../../components/ui';
import { router } from 'expo-router';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { SOUND_LABEL, VOLUME_LABEL } from './timer-pick';

const Section = ({ title }: { title: string }) => <Text style={{ color: colors.muted, fontSize: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{title}</Text>;

/** Sounds: tipo do som do timer e volume do timer, do check da série e do aviso de recorde. */
export default function TimerSounds() {
  const { wprefs: p } = useStore();
  const go = (key: string) => () => router.push({ pathname: '/settings/timer-pick', params: { key } });
  return (
    <Screen>
      <Header title="Sounds" />
      <View>
        <Section title="Sound Type" />
        <ListRow label="Timer Sound" detail={SOUND_LABEL[p.timerSound]} onPress={go('timerSound')} testID="timer-sound" />
        <Section title="Sounds Volume" />
        <ListRow label="Timer Volume" detail={VOLUME_LABEL[p.timerVolume]} onPress={go('timerVolume')} testID="timer-volume" />
        <ListRow label="Check Set" detail={VOLUME_LABEL[p.checkVolume]} onPress={go('checkVolume')} testID="check-volume" />
        <ListRow label="Live Personal Record Volume" detail={VOLUME_LABEL[p.prVolume]} onPress={go('prVolume')} testID="pr-volume" last />
      </View>
    </Screen>
  );
}
