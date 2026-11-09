import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { Text } from '../../../components/Text';
import { Card, Header, Screen } from '../../../components/ui';
import { PROGRAMS } from '../../../lib/constants';
import { colors } from '../../../lib/theme';

export default function Program() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = PROGRAMS.find((x) => x.id === id);
  return (
    <Screen>
      <Header title={p?.title ?? 'Program'} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: colors.muted }}>{p?.subtitle}</Text>
        {p?.routines.map((r, i) => (
          <Card key={r.title} onPress={() => router.push({ pathname: '/routines/preview', params: { src: 'program', id: p.id, idx: String(i) } })} style={{ gap: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{r.title}</Text>
            <Text style={{ color: colors.muted }}>{r.exercises.length} exercises</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
