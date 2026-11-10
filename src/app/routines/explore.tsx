import { Ionicons } from '@expo/vector-icons';
import { IconCircle } from '../../components/IconCircle';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Card, Header, Screen } from '../../components/ui';
import { CATEGORIES, PROGRAMS } from '../../lib/constants';
import { equipImage, muscleImage } from '../../lib/iconImages';
import { colors, radius } from '../../lib/theme';

/** Ícone 3D de cada categoria de rotinas (mesmo estilo dos filtros de equipamento e músculo). */
const categoryImage = (id: string) => (id === 'cardio' ? muscleImage('Cardio') : equipImage(({ home: 'kettlebell', travel: 'suspension', dumbbell: 'dumbbell', band: 'band', gym: 'machine', body: 'bodyweight' } as Record<string, string>)[id]));

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
              <View style={{ alignSelf: 'flex-end' }}><IconCircle source={categoryImage(c.id)} size={44} /></View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
