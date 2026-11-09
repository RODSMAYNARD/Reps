import { ScrollView } from 'react-native';
import { Text } from '../../components/Text';
import { Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const BLOCKS: [string, string][] = [
  ['Progressive overload', 'Muscles grow when the work gets a little harder over time. Your program keeps the same lifts for a full block so you can add weight or reps week after week.'],
  ['Training frequency', 'Hitting each muscle group about twice a week is a good balance of stimulus and recovery for most people. The split you choose follows the days you can train.'],
  ['Rep ranges', 'Heavy compound lifts use lower reps to build strength. Isolation lifts use higher reps to add volume with less fatigue.'],
  ['Rest between sets', 'Longer rests help you lift heavier on the next set. Choose short, medium or long rest and the timer follows.'],
  ['Variety and deloads', 'A block of 6 weeks, then a refresh of exercises, keeps training interesting. An optional lighter week lets your body recover.'],
];
export default function Science() {
  return (
    <Screen>
      <Header title="Science Behind Trainer" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <Text style={{ color: colors.muted, fontSize: 16 }}>The Trainer builds your program from a few well-established training principles. It is general guidance, not medical advice.</Text>
        {BLOCKS.map(([t, d]) => <Text key={t} style={{ color: colors.text, fontSize: 16 }}><Text style={{ fontWeight: '700' }}>{t}{'\n'}</Text>{d}</Text>)}
      </ScrollView>
    </Screen>
  );
}
