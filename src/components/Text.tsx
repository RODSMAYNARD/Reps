import { Children, type ComponentProps } from 'react';
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextStyle } from 'react-native';
import { tr } from '../lib/i18n';

/**
 * Fonte do app. iOS: a do sistema (San Francisco, o padrão Apple). Android: Inter, a mais parecida com a SF
 * (a SF só pode ser usada em aparelhos Apple). Com a fonte do fabricante (Xiaomi, OnePlus...) o Android mede
 * a palavra mais curta do que desenha e corta a última letra ("Padrã", "Volum"); com uma fonte nossa não corta.
 * Carregada em `_layout.tsx` (`APP_FONTS`).
 */
export const APP_FONTS = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  Inter_800ExtraBold: require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'),
};

/** Família da Inter para o peso pedido (no Android a fonte própria não engrossa sozinha com fontWeight). */
export function interFamily(weight?: TextStyle['fontWeight']) {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight) || 400;
  return w >= 800 ? 'Inter_800ExtraBold' : w >= 700 ? 'Inter_700Bold' : w >= 600 ? 'Inter_600SemiBold' : w >= 500 ? 'Inter_500Medium' : 'Inter_400Regular';
}

const android = Platform.OS === 'android';

/** No Android troca o peso pela família da Inter certa (respeita uma fontFamily já escolhida, ex. monoespaçada). */
export function fontStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (!android) return style;
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return style;
  return [style, { fontFamily: interFamily(flat.fontWeight), fontWeight: 'normal' }];
}

/** Traduz os pedaços de texto literais (strings) dos filhos; números e elementos passam direto. */
const translate = (children: React.ReactNode) =>
  typeof children === 'string' ? tr(children) : Array.isArray(children) ? Children.map(children, (c) => (typeof c === 'string' ? tr(c) : c)) : children;

/** `Text` do React Native com a fonte do app e tradução automática do idioma escolhido (ver `lib/i18n.ts`). */
export function Text({ children, style, ...rest }: ComponentProps<typeof RNText>) {
  return <RNText {...rest} style={fontStyle(style)}>{translate(children)}</RNText>;
}

/** `Text` com a fonte do app, SEM tradução (textos já prontos no idioma, como as mensagens do Coach). */
export function PlainText({ style, ...rest }: ComponentProps<typeof RNText>) {
  return <RNText {...rest} style={fontStyle(style)} />;
}

/** `TextInput` com a fonte do app e o placeholder traduzido. */
export function TextInput({ placeholder, style, ...rest }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput placeholder={placeholder == null ? placeholder : tr(placeholder)} {...rest} style={fontStyle(style)} />;
}
