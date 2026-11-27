import { Platform } from 'react-native';

/** Só no computador (localhost, modo dev): o app aberto direto numa aba vai para a moldura do iPhone (`public/iphone.html`).
 * Dentro da moldura (iframe), no celular pelo IP da rede e na web publicada nada muda. `?noframe` abre sem moldura. */
if (Platform.OS === 'web' && __DEV__ && typeof window !== 'undefined') {
  const { hostname, pathname, search, hash } = window.location;
  const top = (() => { try { return window.top === window.self; } catch { return false; } })();
  if (top && (hostname === 'localhost' || hostname === '127.0.0.1') && !search.includes('noframe')) {
    window.location.replace('/iphone.html?device=iphone&path=' + encodeURIComponent(pathname + search + hash));
  }
}
