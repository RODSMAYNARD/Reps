import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { RecoveryCard } from '../../components/HealthCards';
import { Text } from '../../components/Text';
import { BarChart, Btn, Dialog, Header, Screen, Section, Toggle } from '../../components/ui';
import { connect, DEVICES, disconnect, getStatus, installHealthConnect, openSystemSettings, PROVIDER, PROVIDER_NAME, setWriteWorkouts, sync, useHealth, type Status } from '../../lib/health';
import { tr } from '../../lib/i18n';
import { colors, radius } from '../../lib/theme';

/** Wearables: relógios e pulseiras chegam pelo Apple Saúde (iOS) ou Health Connect (Android). */
export default function Integrations() {
  const h = useHealth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { getStatus().then(setStatus); }, []);

  const onConnect = async () => {
    if (status === 'not-installed' || status === 'needs-update') { installHealthConnect(); return; }
    if (status !== 'ready') { setMsg(status === 'needs-build' ? 'This version of the app was built before wearables support. Install the latest version to connect.' : 'Health data is not available on this device.'); return; }
    setBusy(true);
    const ok = await connect();
    setBusy(false);
    if (!ok) setMsg(`No permission was given. You can allow access in ${PROVIDER_NAME}.`);
  };

  const statusText = !status ? '' : h.connected ? 'Connected' : status === 'ready' ? 'Not connected'
    : status === 'not-installed' ? 'Health Connect is not installed' : status === 'needs-update' ? 'Health Connect needs an update'
    : status === 'needs-build' ? 'Needs the latest app version' : 'Not available on this device';
  const last14 = h.days.slice(-14);
  const sleepBars = last14.map((d) => ({ label: d.date.slice(8), value: Math.round(((d.sleepMin ?? 0) / 60) * 10) / 10 }));

  return (
    <Screen>
      <Header title="Integrations" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {!PROVIDER ? (
          <Text style={{ padding: 16, color: colors.muted }}>Watches and bands connect on the iPhone and Android app.</Text>
        ) : (
          <>
            <View style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: '#FF2D55', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="heart" size={26} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{PROVIDER_NAME}</Text>
                  <Text style={{ fontSize: 13, color: h.connected ? colors.success : colors.muted }} testID="health-status">{statusText}</Text>
                </View>
                {!h.connected && <Btn title={status === 'not-installed' || status === 'needs-update' ? 'Install' : 'Connect'} loading={busy} style={{ minHeight: 40 }} onPress={onConnect} testID="health-connect" />}
              </View>
              <Text style={{ color: colors.muted }}>
                {tr('Reps reads sleep, heart rate, HRV and steps from your watch or band through')} {PROVIDER_NAME}. {tr('Your health data stays on this phone.')}
              </Text>
            </View>

            {h.connected && (
              <>
                <RecoveryCard style={{ marginHorizontal: 16 }} />
                {sleepBars.some((b) => b.value > 0) && (
                  <>
                    <Section title="Sleep (hours)" />
                    <View style={{ paddingHorizontal: 16 }}><BarChart data={sleepBars} highlightLast /></View>
                  </>
                )}
                <Section title="Options" />
                <Toggle label={`${tr('Save workouts to')} ${PROVIDER_NAME}`} subtitle="Finished workouts appear in your health app and on your watch's activity." value={h.writeWorkouts} onChange={setWriteWorkouts} />
                <View style={{ padding: 16, gap: 10 }}>
                  <Btn title="Sync now" variant="secondary" onPress={() => sync()} />
                  <Btn title={`${tr('Manage permissions in')} ${PROVIDER_NAME}`} variant="secondary" onPress={openSystemSettings} />
                  <Btn title="Disconnect" variant="outline" onPress={disconnect} />
                  {!!h.syncedAt && <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{tr('Last sync')}: {new Date(h.syncedAt).toLocaleString()}</Text>}
                </View>
              </>
            )}

            <Section title="Works with" />
            <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DEVICES[PROVIDER].map((d) => (
                <View key={d} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface }}><Text style={{ color: colors.text, fontSize: 13 }}>{d}</Text></View>
              ))}
            </View>
            <Text style={{ padding: 16, color: colors.muted, fontSize: 13 }}>
              {Platform.OS === 'ios'
                ? 'Turn on Apple Health sync in your device\'s app (Garmin Connect, Oura, Whoop...). Fitbit does not write to Apple Health on iPhone.'
                : 'In your device\'s app (Fitbit, Samsung Health, Garmin Connect, Oura...), turn on Health Connect sync.'}
            </Text>
          </>
        )}
      </ScrollView>
      <Dialog visible={!!msg} title={PROVIDER_NAME} message={msg ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => setMsg(null) }]} />
    </Screen>
  );
}
