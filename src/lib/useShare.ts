import { tr } from './i18n';
import { copyText, shareFile, shareText, type ShareResult } from './share';
import { useStore } from './store';

/** "<texto> on Reps" no idioma do app (as mensagens compartilhadas não passam pelo `Text`). */
export const onReps = (s: string) => `${s} ${tr('on Reps')}`;

/** Compartilhar com aviso: diz quando copiou ou baixou em vez de abrir a folha do sistema, e quando falhou. */
export function useShare() {
  const { showToast } = useStore();
  const tell = (r: ShareResult, what: 'text' | 'image' | 'file') => {
    if (r === 'copied') showToast('Copied! Paste it anywhere.');
    else if (r === 'downloaded') showToast(what === 'image' ? 'Image saved to your downloads.' : 'File saved to your downloads.');
    else if (r === 'failed') showToast("Couldn't share. Try again.");
    return r;
  };
  return {
    text: async (message: string, title?: string) => tell(await shareText(message, title), 'text'),
    image: async (uri: string, name = 'reps.png') => tell(await shareFile({ uri }, { name, mime: 'image/png' }), 'image'),
    /** Só na web: baixa a imagem (no aparelho o Download usa a galeria). */
    downloadImage: async (uri: string, name = 'reps.png') => tell(await shareFile({ uri }, { name, mime: 'image/png', download: true }), 'image'),
    file: async (src: { uri: string } | { text: string }, name: string, mime: string) => tell(await shareFile(src, { name, mime }), 'file'),
    copy: async (text: string) => { const ok = await copyText(text); showToast(ok ? 'Copied!' : "Couldn't copy."); return ok; },
  };
}
