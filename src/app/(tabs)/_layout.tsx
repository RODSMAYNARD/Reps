import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '../../components/Text';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLang, tr } from '../../lib/i18n';
import { colors } from '../../lib/theme';

const tab = (title: string, on: any, off: any) => ({
  title: tr(title),
  tabBarIcon: ({ focused, color }: { focused: boolean; color: any }) => <Ionicons name={focused ? on : off} size={24} color={color} />,
});

export default function TabsLayout() {
  // A altura padrão (49) espreme o rótulo: ícone 28 + texto 14 + respiro precisam de 56, mais a barra do sistema embaixo.
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: fontStyle({ fontSize: 11, lineHeight: 14, flexShrink: 0 }) as object, tabBarItemStyle: { paddingTop: 5, paddingBottom: 5 }, tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 56 + insets.bottom, paddingBottom: insets.bottom }, sceneStyle: { backgroundColor: colors.bg } }}>
      {/* "/" só redireciona para a H2; Social fica escondida até a v2 */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="social" options={{ ...tab('Social', 'people', 'people-outline'), href: null }} />
      {/* H2: Home alternativa em teste (casa de cabeça para baixo) */}
      <Tabs.Screen name="h2" options={{ title: 'H2', tabBarIcon: ({ focused, color }: { focused: boolean; color: any }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} style={{ transform: [{ rotate: '180deg' }] }} /> }} />
      {/* G: planos de 30 dias + treino do dia gerado, em teste */}
      {/* G = "Training" (2026-11-23); em pt "Treinamento", porque "Training" no dicionário já é "Treino" (= aba Workout) */}
      <Tabs.Screen name="g" options={{ title: getLang() === 'pt' ? 'Planos' : 'Plans', tabBarIcon: ({ focused, color }: { focused: boolean; color: any }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} /> }} />
      <Tabs.Screen name="treino" options={tab('Workout', 'barbell', 'barbell-outline')} />
      {/* Coach: só a conversa com o Coach Reps */}
      <Tabs.Screen name="coach" options={tab('Coach', 'chatbubble-ellipses', 'chatbubble-ellipses-outline')} />
      {/* Trainer virou "Programs" na barra (2026-11-23); as telas internas ainda dizem Trainer */}
      <Tabs.Screen name="plano" options={tab('Programs', 'sparkles', 'sparkles-outline')} />
      {/* Exercícios saiu da barra (2026-11-23): a biblioteca abre pelo Perfil > Exercises e pelos seletores */}
      <Tabs.Screen name="exercicios" options={{ ...tab('Exercises', 'list', 'list-outline'), href: null }} />
      <Tabs.Screen name="perfil" options={tab('Profile', 'person', 'person-outline')} />
    </Tabs>
  );
}
