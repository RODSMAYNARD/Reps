import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Btn, Card, Header, Screen } from '../../components/ui';
import { CATEGORIES, PROGRAMS } from '../../lib/constants';
import { colors, radius } from '../../lib/theme';

export default function Explore() {
  const [all, setAll] = useState(false);
  const progs = all ? PROGRAMS : PROGRAMS.slice(0, 2);
  return (
    <Screen>
      <Header title="Explore" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Btn title="Generate custom plan" icon="sparkles-outline" onPress={() => router.push('/routines/generate')} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Programs</Text>
        {progs.map((p) => (
          <Card key={p.id} onPress={() => router.push({ pathname: '/routines/program/[id]', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} >
            <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="calendar-outline" size={30} color={colors.primary} /></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{p.title}</Text><Text style={{ color: colors.muted }}>{p.subtitle}</Text></View>
          </Card>
        ))}
        <Btn title={all ? 'Show fewer programs' : 'Show more programs'} variant="secondary" onPress={() => setAll(!all)} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 }}>Routines</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.id} onPress={() => router.push({ pathname: '/routines/category/[id]', params: { id: c.id } })} style={{ width: '47.5%', backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, minHeight: 84, justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, color: colors.text }}>{c.label}</Text>
              <Ionicons name={c.icon as any} size={30} color={colors.primary} style={{ alignSelf: 'flex-end' }} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
