import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const FAQ = [
  ['How do I create a routine?', 'Go to Workout › New Routine, give it a title, add exercises, and tap Save.'],
  ['How does the rest timer work?', 'Set the rest time for each exercise. When you check off a set with ✓, the timer starts automatically.'],
  ['What are warm-up, failure, and drop sets?', 'Tap the set number to change the type. Warm-up sets do not count toward volume.'],
  ['How do I change a workout\'s duration?', 'Tap the duration during your workout to adjust the minutes or pause the timer.'],
  ['How do I switch from kg to lbs?', 'Settings › Units.'],
  ['Is my data saved if I switch phones?', 'Yes. It lives in your account; just sign in with the same email.'],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Screen>
      <Header title="FAQ" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {FAQ.map(([q, a], i) => (
          <Pressable key={q} onPress={() => setOpen(open === i ? null : i)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{q}</Text><Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} /></View>
            {open === i && <Text style={{ color: colors.muted }}>{a}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
