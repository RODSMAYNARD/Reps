import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../lib/theme';

function Routes() {
  const { ready, session, profile, toast } = useStore();
  if (!ready)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  const onboarded = !!session && profile.onboarded;
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Routes />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
