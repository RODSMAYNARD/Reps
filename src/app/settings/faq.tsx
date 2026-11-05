import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Header, Screen } from '../../components/ui';
import { colors } from '../../lib/theme';

const FAQ = [
  ['Como crio uma rotina?', 'Vá em Treino › Nova rotina, dê um título, adicione exercícios e toque em Salvar.'],
  ['Como funciona o cronômetro de descanso?', 'Defina o descanso de cada exercício. Ao marcar uma série com ✓, o cronômetro inicia sozinho.'],
  ['O que são séries de aquecimento, falha e drop set?', 'Toque no número da série para trocar o tipo. Aquecimento não conta no volume.'],
  ['Como altero a duração de um treino?', 'Toque na duração durante o treino para ajustar os minutos ou pausar o cronômetro.'],
  ['Como mudo de kg para lbs?', 'Configurações › Unidades.'],
  ['Meus dados ficam salvos se eu trocar de celular?', 'Sim. Eles ficam na sua conta; é só entrar com o mesmo e-mail.'],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Screen>
      <Header title="Perguntas frequentes" />
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
