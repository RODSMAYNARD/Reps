import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dialog } from '../../components/ui';

export function SocialButton({ icon, label, onPress, color = '#0B1220' }: { icon: any; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: '#F2F4F7', borderRadius: 12, height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, color: '#0B1220', marginRight: 22 }}>{label}</Text>
    </Pressable>
  );
}

export default function Welcome() {
  const [soon, setSoon] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', marginTop: 60, gap: 6 }}>
          <Ionicons name="barbell" size={56} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: 6 }}>REPS</Text>
          <Text style={{ color: '#9AA3AF', fontSize: 15, marginTop: 6 }}>Log workouts. See progress.</Text>
        </View>
        <View style={{ gap: 10 }}>
          <SocialButton icon="logo-apple" label="Sign up with Apple" onPress={() => setSoon(true)} />
          <SocialButton icon="logo-google" label="Sign up with Google" onPress={() => setSoon(true)} />
          <SocialButton icon="mail-outline" label="Sign up with email" onPress={() => router.push('/signup')} />
          <Pressable onPress={() => router.push('/login')} style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ color: '#fff' }}>Already have an account? <Text style={{ color: '#4DA3FF' }}>Log in</Text></Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <Dialog visible={soon} title="Coming soon" message="This kind of login needs native setup and will be enabled in the published version. Use email for now." actions={[{ label: 'Ok', primary: true, onPress: () => setSoon(false) }]} />
    </View>
  );
}
