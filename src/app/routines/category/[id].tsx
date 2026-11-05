import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { Card, Empty, Header, Screen } from '../../../components/ui';
import { CATEGORIES, CATEGORY_ROUTINES } from '../../../lib/constants';
import { colors } from '../../../lib/theme';

export default function Category() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = CATEGORIES.find((x) => x.id === id);
  const list = CATEGORY_ROUTINES[id] ?? [];
  return (
    <Screen>
      <Header title={`Rotinas · ${c?.label ?? ''}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {list.length === 0 && <Empty text="Ainda não temos rotinas nessa categoria." />}
        {list.map((r, i) => (
          <Card key={r.title} onPress={() => router.push({ pathname: '/routines/preview', params: { src: 'cat', id: id!, idx: String(i) } })} style={{ gap: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{r.title}</Text>
            <Text style={{ color: colors.muted }} numberOfLines={2}>{r.notes}</Text>
            <Text style={{ color: colors.muted }}>{r.exercises.length} exercícios</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
