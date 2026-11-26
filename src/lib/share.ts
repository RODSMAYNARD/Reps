import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/** Compartilhar em um lugar só (2026-11-23). Antes cada botão chamava `Share.share`/`expo-sharing` direto e, na web
 * sem HTTPS (o app aberto no celular por http://<IP do PC>), o navegador não tem `navigator.share` nem a área de
 * transferência moderna: a chamada falhava em silêncio e parecia que nenhum botão funcionava.
 * Ordem: folha de compartilhar do sistema → (texto) copiar → (arquivo/imagem) baixar. Quem chama mostra o aviso
 * conforme o resultado (`useShare` em `lib/useShare.ts`). */
export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

type WebNav = Navigator & { share?: (d: { title?: string; text?: string; files?: File[] }) => Promise<void>; canShare?: (d: { files?: File[] }) => boolean };
const webNav = (): WebNav | undefined => (typeof navigator === 'undefined' ? undefined : (navigator as WebNav));
const isAbort = (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError';

/** Cópia antiga (funciona sem HTTPS): textarea escondido + execCommand. */
function copyLegacy(text: string) {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try { await Clipboard.setStringAsync(text); return true; } catch { return false; }
  }
  try {
    const c = webNav()?.clipboard;
    if (c?.writeText) { await c.writeText(text); return true; }
  } catch { /* sem permissão: tenta o jeito antigo */ }
  return copyLegacy(text);
}

export async function shareText(message: string, title?: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    try {
      const r = await Share.share(title ? { message, title } : { message });
      return r.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch { return (await copyText(message)) ? 'copied' : 'failed'; }
  }
  const nav = webNav();
  if (typeof nav?.share === 'function') {
    try { await nav.share({ title, text: message }); return 'shared'; } catch (e) { if (isAbort(e)) return 'cancelled'; }
  }
  return (await copyText(message)) ? 'copied' : 'failed';
}

/** Arquivo ou imagem: `uri` (imagem capturada / arquivo gravado) ou `text` (conteúdo do arquivo, ex.: CSV). */
export async function shareFile(src: { uri: string } | { text: string }, opts: { name: string; mime: string; download?: boolean }): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    if (!('uri' in src)) return 'failed';
    try {
      if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(src.uri, { mimeType: opts.mime, dialogTitle: opts.name }); return 'shared'; }
      await Share.share({ url: src.uri, message: Platform.OS === 'android' ? src.uri : undefined });
      return 'shared';
    } catch { return 'failed'; }
  }
  try {
    const blob = 'text' in src ? new Blob([src.text], { type: opts.mime }) : await (await fetch(src.uri)).blob();
    const nav = webNav();
    if (!opts.download && typeof File !== 'undefined' && typeof nav?.share === 'function') {
      const file = new File([blob], opts.name, { type: opts.mime });
      if (nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], title: opts.name }); return 'shared'; } catch (e) { if (isAbort(e)) return 'cancelled'; }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch { return 'failed'; }
}
