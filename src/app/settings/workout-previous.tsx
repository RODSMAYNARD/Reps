import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { Header, ListRow, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function PreviousValues() {
  const { wprefs, setWprefs } = useStore();
  const opts = [
    { id: 'any' as const, label: 'Any workout', sub: 'Your previous exercise values will be fetched from the last time you did that exercise, regardless of routines.' },
    { id: 'routine' as const, label: 'Same Routine', sub: 'Your previous exercise values will be fetched from the last time you did that exercise in the current routine you are performing.' },
  ];
  return (
    <Screen>
      <Header title="Previous Workout Values" />
      <View style={{ paddingTop: 8 }}>
        {opts.map((o) => (
          <ListRow key={o.id} label={o.label} subtitle={o.sub} onPress={() => setWprefs({ prevMode: o.id })} testID={`prev-${o.id}`}
            right={wprefs.prevMode === o.id ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : undefined} />
        ))}
        <Text style={{ color: colors.muted, padding: 16, fontSize: 13 }}>Applies to the PREVIOUS column and to the values pre-filled when you start a workout.</Text>
      </View>
    </Screen>
  );
}
