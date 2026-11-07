import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { refreshStyles } from '../components/ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Telemetry } from '../components/Telemetry';
import { WorkoutNotifier } from '../components/WorkoutNotifier';
import { wrapRoot } from '../lib/monitoring';
import { StoreProvider, useStore } from '../lib/store';
import { applyScheme, colors, type Scheme } from '../lib/theme';

/** Tema efetivo: a preferência (claro, escuro ou automático = o do aparelho). Aplica a paleta ANTES de desenhar as telas. */
function useScheme(): Scheme {
  const { profile } = useStore();
  const system = useColorScheme();
  const scheme: Scheme = profile.theme === 'dark' ? 'dark' : profile.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : 'light';
  applyScheme(scheme);
  refreshStyles();
  return scheme;
}

function Routes() {
  const { ready, session, profile, toast } = useStore();
  const scheme = useScheme();
  if (!ready)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  const onboarded = !!session && profile.onboarded;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack key={scheme} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !profile.onboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="active" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="routines" />
          <Stack.Screen name="trainer" />
          <Stack.Screen name="exercises" />
          <Stack.Screen name="feed" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
      </Stack>
      {!!toast && (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, left: 24, right: 24, alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.black, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ color: '#fff' }}>{toast}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Routes />
        <WorkoutNotifier />
        <Telemetry />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);
