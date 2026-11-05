import { useEffect, useState } from 'react';
import { TextInput, TextStyle } from 'react-native';
import { colors } from '../lib/theme';

export function NumInput({ value, onChange, decimal, style, placeholder = '0', testID }: { value: number | null; onChange: (v: number | null) => void; decimal?: boolean; style?: TextStyle; placeholder?: string; testID?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'));
    if ((isNaN(parsed) ? null : parsed) !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextInput
      testID={testID}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onChangeText={(t) => {
        setText(t);
        const p = parseFloat(t.replace(',', '.'));
        onChange(isNaN(p) ? null : p);
      }}
      style={[{ textAlign: 'center', fontSize: 16, color: colors.text, paddingVertical: 8 }, style]}
    />
  );
}
