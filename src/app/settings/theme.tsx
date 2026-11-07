import { Ionicons } from '@expo/vector-icons';
import { Header, ListRow, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function ThemeSettings() {
  const { profile, saveProfile } = useStore();
  const opts = [
    { id: 'light', label: 'Light', sub: 'Always use the light theme' },
    { id: 'dark', label: 'Dark', sub: 'Always use the dark theme' },
    { id: 'system', label: 'Automatic (system)', sub: 'Follows your phone settings' },
  ] as const;
  return (
    <Screen>
      <Header title="Theme" />
      {opts.map((o) => (
        <ListRow key={o.id} label={o.label} subtitle={o.sub} last right={profile.theme === o.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined}
          onPress={() => { saveProfile({ theme: o.id }); }} />
      ))}
    </Screen>
  );
}
