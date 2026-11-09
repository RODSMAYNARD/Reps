import { Children, type ComponentProps } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { tr } from '../lib/i18n';

/** Traduz os pedaços de texto literais (strings) dos filhos; números e elementos passam direto. */
const translate = (children: React.ReactNode) =>
  typeof children === 'string' ? tr(children) : Array.isArray(children) ? Children.map(children, (c) => (typeof c === 'string' ? tr(c) : c)) : children;

/** `Text` do React Native com tradução automática do idioma escolhido (ver `lib/i18n.ts`). */
export function Text({ children, ...rest }: ComponentProps<typeof RNText>) {
  return <RNText {...rest}>{translate(children)}</RNText>;
}

/** `TextInput` com o placeholder traduzido. */
export function TextInput({ placeholder, ...rest }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput placeholder={placeholder == null ? placeholder : tr(placeholder)} {...rest} />;
}
