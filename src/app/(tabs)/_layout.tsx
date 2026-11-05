import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../lib/theme';

function icon(e: string) {
  const Icon = () => <Text style={{ fontSize: 18 }}>{e}</Text>;
  Icon.displayName = 'TabIcon';
  return Icon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Treino', tabBarIcon: icon('🏋️') }} />
      <Tabs.Screen name="exercicios" options={{ title: 'Exercícios', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: icon('🕘') }} />
      <Tabs.Screen name="progresso" options={{ title: 'Progresso', tabBarIcon: icon('📈') }} />
    </Tabs>
  );
}
