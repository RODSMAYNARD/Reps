import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { Btn, Dialog, TextLink } from './ui';

const BENEFITS = ['Rotinas ilimitadas', 'Estatísticas avançadas por músculo', 'Gráficos de evolução de cada exercício', 'Exportar todos os seus dados', 'Sem anúncios'];
const PLANS = [
  { id: 'month', title: 'Mensal', price: 'R$ 19,90 / mês', note: '' },
  { id: 'year', title: 'Anual', price: 'R$ 129,90 / ano', note: 'Economize 45%' },
  { id: 'life', title: 'Vitalício', price: 'R$ 299,90 uma vez', note: 'Pague uma vez' },
];
const FAQ = [
  ['O que o Reps Pro inclui?', 'Rotinas ilimitadas, estatísticas avançadas, gráficos por exercício e exportação de dados.'],
  ['É pagamento único ou renova sozinho?', 'Os planos mensal e anual renovam automaticamente. O vitalício é pagamento único.'],
  ['Posso cancelar quando quiser?', 'Sim. Você cancela na loja de aplicativos e mantém o acesso até o fim do período pago.'],
  ['É possível pedir reembolso?', 'Reembolsos são tratados pela loja de aplicativos onde a compra foi feita.'],
  ['Posso trocar de plano?', 'Sim, a qualquer momento pela sua conta na loja.'],
  ['O que acontece se eu trocar de aparelho?', 'Entre com a mesma conta e use “Restaurar compras”.'],
];

export function Paywall({ onContinueFree, freeLabel = 'Continuar grátis' }: { onContinueFree: () => void; freeLabel?: string }) {
  const [plan, setPlan] = useState('year');
  const [open, setOpen] = useState<number | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 10 }}>
        <Ionicons name="trophy" size={48} color={colors.warn} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Reps Pro</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Desbloqueie tudo para acompanhar sua evolução.</Text>
      </View>
      <View style={{ gap: 10 }}>
        {BENEFITS.map((b) => (
          <View key={b} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.text, fontSize: 15 }}>{b}</Text>
          </View>
        ))}
      </View>
      {PLANS.map((p) => (
        <Pressable key={p.id} onPress={() => setPlan(p.id)} style={{ borderWidth: 2, borderColor: plan === p.id ? colors.primary : colors.border, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name={plan === p.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={plan === p.id ? colors.primary : colors.faint} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{p.title}</Text>
            <Text style={{ color: colors.muted }}>{p.price}</Text>
          </View>
          {!!p.note && <Text style={{ color: colors.success, fontWeight: '600' }}>{p.note}</Text>}
        </Pressable>
      ))}
      <Btn title="Assinar" onPress={() => setDlg('As compras ainda não estão ativas nesta versão. Quando o app for publicado nas lojas, o pagamento será liberado.')} />
      <Btn title={freeLabel} variant="secondary" onPress={onContinueFree} />
      <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.text, marginTop: 10 }}>Alguma dúvida?</Text>
      {FAQ.map(([q, a], i) => (
        <Pressable key={q} onPress={() => setOpen(open === i ? null : i)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{q}</Text>
            <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
          </View>
          {open === i && <Text style={{ color: colors.muted }}>{a}</Text>}
        </Pressable>
      ))}
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <Text style={{ color: colors.muted }}>Problemas com sua assinatura?</Text>
        <TextLink title="Fale com a gente" onPress={() => Linking.openURL('mailto:rodrigo.maynard@gmail.com')} />
        <TextLink title="Restaurar compras" onPress={() => setDlg('Nenhuma compra encontrada para restaurar.')} />
      </View>
      <Dialog visible={!!dlg} message={dlg ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => setDlg(null) }]} />
    </ScrollView>
  );
}
