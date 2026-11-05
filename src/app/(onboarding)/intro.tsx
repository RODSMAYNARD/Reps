import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Btn, Screen, TextLink } from '../../components/ui';
import { colors, radius } from '../../lib/theme';

const SLIDES = [
  { icon: 'create-outline', title: 'Registre seus treinos', text: 'Anote séries, cargas e repetições em segundos, com o histórico do último treino ao lado.' },
  { icon: 'stats-chart-outline', title: 'Acompanhe o progresso', text: 'Veja gráficos de força, volume e recordes pessoais de cada exercício.' },
  { icon: 'clipboard-outline', title: 'Monte suas rotinas', text: 'Crie rotinas reutilizáveis ou comece por um programa pronto.' },
  { icon: 'timer-outline', title: 'Descanso automático', text: 'O cronômetro de descanso inicia sozinho quando você conclui uma série.' },
] as const;

export default function Intro() {
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const ref = useRef<any>(null);
  const next = () => {
    if (i === SLIDES.length - 1) return router.push('/about-you');
    ref.current?.scrollTo({ x: (i + 1) * width, animated: true });
    setI(i + 1);
  };
  return (
    <Screen>
      <View style={{ alignItems: 'flex-end', padding: 16 }}><TextLink title="Pular" onPress={() => router.push('/about-you')} /></View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))} style={{ flex: 1 }}>
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width, padding: 24, alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 10 }}>{s.title}</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 16 }}>{s.text}</Text>
            <View style={{ width: '80%', flex: 1, maxHeight: 320, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <Ionicons name={s.icon} size={96} color={colors.primary} />
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 12 }}>
        {SLIDES.map((_, k) => <View key={k} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k === i ? colors.primary : colors.border }} />)}
      </View>
      <View style={{ padding: 16 }}><Btn title="Continuar" testID="intro-continue" onPress={next} /></View>
    </Screen>
  );
}
