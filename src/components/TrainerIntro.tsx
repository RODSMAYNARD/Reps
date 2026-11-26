import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { Btn } from './ui';
import { colors, radius } from '../lib/theme';

type Icon = keyof typeof Ionicons.glyphMap;

/** Proporções do resto do app (2026-11-23: a 1ª versão copiou os pixels do print e ficou gigante): título 22, chips 36, textos 15/13, botões Btn padrão.
 * Abertura da aba Programas (Trainer) quando ainda não há programa (pedido do Rodrigo, 2026-11-23, referência: Hevy Trainer).
 * Título, nuvem de chips com o que o programa leva em conta, vantagens, dúvidas frequentes (abre/fecha) e rodapé fixo com
 * "Começar com o Trainer" e "Criar meus próprios treinos". Textos nossos. */
export function TrainerIntro() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} testID="trainer-intro">
        <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.text, textAlign: 'center', paddingHorizontal: 28, marginTop: 16, marginBottom: 18 }}>
          Follow a guided program that progresses with you
        </Text>

        {/* Nuvem de chips: o que o programa leva em conta; o do meio (azul) é o programa montado com tudo isso */}
        <View style={{ gap: 8, overflow: 'hidden', marginBottom: 22 }}>
          <ChipRow items={[{ i: 'time-outline', t: 'Duration', ghost: true }, { i: 'flag-outline', t: 'Goal' }, { i: 'body-outline', t: 'Muscles' }, { i: 'calendar-outline', t: 'Days', ghost: true }]} />
          <ChipRow items={[{ i: 'repeat-outline', t: 'Variety', ghost: true }, { i: 'sparkles', t: 'Personalized program', main: true }, { i: 'medkit-outline', t: 'Injuries', ghost: true }]} />
          <ChipRow items={[{ i: 'timer-outline', t: 'Rest', ghost: true }, { i: 'barbell-outline', t: 'Equipment' }, { i: 'speedometer-outline', t: 'Level' }, { i: 'heart-outline', t: 'Cardio', ghost: true }]} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Feature icon="clipboard-outline" title="Personalized program" sub="Built from your goal, days, level and equipment" />
          <Feature icon="trending-up-outline" title="Progressive overload" sub="The weights go up as you get stronger" />
          <Feature icon="bulb-outline" title="Lighter weeks to recover" sub="A deload week at the end of each 6-week cycle" />
          <Feature icon="calendar-outline" title="Progress report" sub="Follow your performance over time" />
          <Feature icon="flask-outline" title="Science-based" sub="Built on training research." link={{ label: 'Learn more', to: '/trainer/science' }} />
        </View>

        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: 16, marginTop: 24, marginBottom: 10 }}>Any questions?</Text>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {FAQ.map((f, i) => (
            <Pressable key={f.q} onPress={() => setOpen(open === i ? null : i)} testID={`trainer-faq-${i}`} accessibilityRole="button" accessibilityState={{ expanded: open === i }}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{f.q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </View>
              {open === i && <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>{f.a}</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Rodapé fixo */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 + Math.max(0, insets.bottom - 34), gap: 8, backgroundColor: colors.bg }}>
        <Btn title="Start with the Trainer" onPress={() => router.push('/trainer/setup')} testID="trainer-create" />
        <Btn title="Create my own workouts" variant="secondary" onPress={() => router.navigate('/treino')} testID="trainer-own" />
      </View>
    </View>
  );
}

const FAQ = [
  { q: 'What is the Trainer?', a: 'A workout program made for you from your goal, days per week, experience and equipment. It tells you what to do in each workout and raises the weights as you progress.' },
  { q: 'Is the Trainer a real human coach?', a: 'No. The program is built by the app from training rules (sets, reps, rest and progression). No person reviews it.' },
  { q: 'Does the Trainer make generic AI programs?', a: 'No. It doesn’t use AI: it picks exercises from the Reps library that fit your equipment, focus and injuries, and follows a 6-week cycle with progression.' },
  { q: 'Do I have to pay for the Trainer?', a: 'For now it’s free. In the future it will be part of Reps Pro.' },
  { q: 'Do I need experience to use the Trainer?', a: 'No. Choose Beginner and the program starts with simpler exercises and moderate loads.' },
  { q: 'Can I change things later?', a: 'Yes. In Program Settings you can change goal, days, equipment, duration, rest, focus, excluded exercises and injuries at any time. Your progress is kept.' },
];

function ChipRow({ items }: { items: { i: Icon; t: string; main?: boolean; ghost?: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
      {items.map((c) => (
        <View key={c.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, flexShrink: 0,
          backgroundColor: c.main ? colors.primary : colors.surface, opacity: c.ghost ? 0.35 : 1 }}>
          <Ionicons name={c.i} size={16} color={c.main ? '#fff' : colors.text} />
          <Text numberOfLines={1} style={{ fontSize: 14, color: c.main ? '#fff' : colors.text }}>{c.t}</Text>
        </View>
      ))}
    </View>
  );
}

function Feature({ icon, title, sub, link }: { icon: Icon; title: string; sub: string; link?: { label: string; to: '/trainer/science' } }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={22} color={colors.text} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
          {sub}{link ? ' ' : ''}{link && <Text style={{ color: colors.primary }} onPress={() => router.push(link.to)}>{link.label}</Text>}
        </Text>
      </View>
    </View>
  );
}
