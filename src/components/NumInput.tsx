import { useState } from 'react';
import { TextStyle } from 'react-native';
import { TextInput } from './Text';
import { colors } from '../lib/theme';

/** Campo numérico: enquanto está focado mostra o texto digitado (permite "7."), fora disso mostra o valor do store. */
export function NumInput({ value, onChange, decimal, style, placeholder = '0', testID, onFocus, onBlur }: { value: number | null; onChange: (v: number | null) => void; decimal?: boolean; style?: TextStyle; placeholder?: string; testID?: string; onFocus?: () => void; onBlur?: () => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const shown = focused ? text : value == null ? '' : String(value);
  return (
    <TextInput
      testID={testID}
      value={shown}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onFocus={() => { setText(value == null ? '' : String(value)); setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      onChangeText={(t) => {
        setText(t);
        const p = parseFloat(t.replace(',', '.'));
        onChange(isNaN(p) ? null : p);
      }}
      style={[{ textAlign: 'center', fontSize: 16, color: colors.text, paddingVertical: 8 }, style]}
    />
  );
}
