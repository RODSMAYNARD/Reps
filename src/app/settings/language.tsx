import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Header, ListRow, Screen } from '../../components/ui';
import { getLangPref, LANGS, setLangPref, type LangPref } from '../../lib/i18n';
import { colors } from '../../lib/theme';

export default function LanguageSettings() {
  const [cur, setCur] = useState<LangPref>(getLangPref());
  return (
    <Screen>
      <Header title="Language" />
      {LANGS.map((o) => (
        <ListRow key={o.id} label={o.label} subtitle={o.id === 'system' ? 'Follows your phone settings' : undefined} last testID={`lang-${o.id}`}
          right={cur === o.id ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined}
          onPress={() => { setCur(o.id); setLangPref(o.id); }} />
      ))}
    </Screen>
  );
}
