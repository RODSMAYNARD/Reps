import { Ionicons } from '@expo/vector-icons';
import { Header, ListRow, Screen } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function ThemeSettings() {
  const { profile, saveProfile, showToast } = useStore();
  const opts = [{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' }, { id: 'system', label: 'Automático (sistema)' }] as const;
  return (
    <Screen>
      <Header title="Tema" />
      {opts.map((o) => (
        <ListRow key={o.id} label={o.label} last right={profile.theme === o.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined}
          onPress={() => { saveProfile({ theme: o.id }); if (o.id !== 'light') showToast('Preferência salva. O tema escuro chega em uma próxima versão.'); }} />
      ))}
    </Screen>
  );
}
