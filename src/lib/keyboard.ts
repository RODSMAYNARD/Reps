import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Altura do teclado aberto (0 = fechado). No app usa os eventos do teclado; no link web (celular) esses eventos não existem,
 * então mede pelo `visualViewport` do navegador (ignora menos de 80 px, que é a barra do navegador).
 */
export function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const f = () => { const v = window.innerHeight - vv.height - vv.offsetTop; setH(v > 80 ? Math.round(v) : 0); };
      vv.addEventListener('resize', f);
      vv.addEventListener('scroll', f);
      f();
      return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return h;
}
