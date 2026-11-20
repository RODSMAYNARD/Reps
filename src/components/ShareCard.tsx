import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * PADRÃO DOS CARTÕES DE COMPARTILHAMENTO (imagem de tamanho fixo que vira PNG: treino concluído, relatório do mês).
 * 1. O cartão tem largura e altura FIXAS e três zonas: topo (opcional), miolo e rodapé (marca REPS + @usuário).
 *    Topo e rodapé têm o tamanho deles e nunca são cobertos.
 * 2. O miolo é sempre um `FitBox`: mede o conteúdo e, se não couber (tradução mais longa, nome comprido, fonte
 *    do aparelho, emoji alto no Android), reduz TUDO junto até caber. Nunca corta, nunca invade topo/rodapé.
 * 3. Texto do cartão com `lineHeight` explícito (inclusive emoji) e textos de uma linha com `numberOfLines={1}`.
 * Ver a skill `rods-share-card`.
 */
export function FitBox({ children, align = 'center', style }: { children: ReactNode; align?: 'center' | 'top'; style?: StyleProp<ViewStyle> }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [inner, setInner] = useState(0);
  const s = box.h > 0 && inner > 0 ? Math.min(1, box.h / inner) : 1;
  // a escala é a partir do centro: compensa a posição. 'center' = no meio da caixa; 'top' = canto de cima à esquerda
  const top = align === 'center' ? (box.h - inner) / 2 : -(inner * (1 - s)) / 2;
  const left = align === 'center' ? 0 : -(box.w * (1 - s)) / 2;
  return (
    <View
      style={[{ flex: 1, overflow: 'hidden' }, style]}
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height })); }}
    >
      {box.w > 0 && (
        <View
          onLayout={(e) => { const h = e.nativeEvent.layout.height; setInner((p) => (Math.abs(p - h) < 0.5 ? p : h)); }}
          style={{ position: 'absolute', left, width: box.w, top, transform: [{ scale: s }], opacity: inner > 0 ? 1 : 0 }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

/** Cartão em três zonas: `top` e `footer` com tamanho próprio, miolo encaixado com `FitBox`. */
export function CardFrame({ pad, gap, top, footer, align, children }: { pad: number; gap: number; top?: ReactNode; footer: ReactNode; align?: 'center' | 'top'; children: ReactNode }) {
  return (
    <View style={{ flex: 1, padding: pad, gap }}>
      {top}
      <FitBox align={align}>{children}</FitBox>
      {footer}
    </View>
  );
}
