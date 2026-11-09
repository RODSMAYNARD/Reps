import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { tr } from '../../lib/i18n';
import { colors } from '../../lib/theme';

const tab = (title: string, on: any, off: any) => ({
  title: tr(title),
  tabBarIcon: ({ focused, color }: { focused: boolean; color: any }) => <Ionicons name={focused ? on : off} size={26} color={color} />,
});

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={tab('Home', 'home', 'home-outline')} />
      <Tabs.Screen name="treino" options={tab('Workout', 'barbell', 'barbell-outline')} />
      <Tabs.Screen name="plano" options={tab('Trainer', 'sparkles', 'sparkles-outline')} />
      <Tabs.Screen name="exercicios" options={tab('Exercises', 'list', 'list-outline')} />
      <Tabs.Screen name="perfil" options={tab('Profile', 'person', 'person-outline')} />
    </Tabs>
  );
}
