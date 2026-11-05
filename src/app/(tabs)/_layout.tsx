import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

const tab = (title: string, on: any, off: any) => ({
  title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: any }) => <Ionicons name={focused ? on : off} size={26} color={color} />,
});

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={tab('Início', 'home', 'home-outline')} />
      <Tabs.Screen name="treino" options={tab('Treino', 'barbell', 'barbell-outline')} />
      <Tabs.Screen name="perfil" options={tab('Perfil', 'person', 'person-outline')} />
    </Tabs>
  );
}
