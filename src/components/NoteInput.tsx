import { useState } from 'react';
import { TextInput } from './Text';
import { colors } from '../lib/theme';

/** No navegador o campo ganha um contorno preto ao focar; aqui não queremos nada em volta. */
const NO_OUTLINE = { outlineStyle: 'none', outlineWidth: 0 } as object;

/** Campo de nota: começa com uma linha, cresce com o texto, sem caixa nem contorno (como no Hevy). */
export function NoteInput({ value, onChangeText, onBlur, autoFocus, placeholder = 'Add a session note' }: {
  value: string; onChangeText: (t: string) => void; onBlur?: () => void; autoFocus?: boolean; placeholder?: string;
}) {
  const [h, setH] = useState(24);
  return (
    <TextInput
      value={value}
      autoFocus={autoFocus}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      multiline
      numberOfLines={1}
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      onContentSizeChange={(e) => setH(Math.max(24, Math.ceil(e.nativeEvent.contentSize.height)))}
      style={[{ flex: 1, height: h, color: colors.text, fontSize: 17, lineHeight: 24, padding: 0, margin: 0, borderWidth: 0, backgroundColor: 'transparent', includeFontPadding: false, textAlignVertical: 'top' }, NO_OUTLINE]}
      testID="note-input"
    />
  );
}
