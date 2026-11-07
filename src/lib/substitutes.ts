import { CATALOG, CAT_BY_ID, type CatItem } from './catalog';

/** Troca de exercício no treino: opções do MESMO músculo (alvo), parecidas no movimento e variando o equipamento. */
export type Sub = { c: CatItem; closest: boolean; why: string };
type Base = { name: string; muscle: string; target?: string | null; equipment: string; kind: string; catalogId?: string | null };

const EQUIP = /\b(barbell|dumbbell|cable|lever|smith|sled|band|ez|kettlebell|weighted|assisted|resistance|stability|exercise|ball|olympic|rope|bar|machine|bodyweight|body)\b/g;
const STOP = new Set(['v', 'with', 'on', 'the', 'and', 'of', 'to', 'a', 'an']);
const SKIP = /stretch|yoga|jump|burpee|crawl|swing|clean|snatch|thruster|plyo|hop|skip|sprint|roll|mobility|pose|bike|treadmill|walk|run|pov|archer|typewriter|muscle[- ]up|clap|^[a-z]-/i;
/** Preferência leve por equipamento comum de academia na hora de escolher a opção mais parecida. */
const EQ_PREF: Record<string, number> = { Barbell: 0.3, Dumbbell: 0.3, Machine: 0.3, Cable: 0.25, Kettlebell: 0.1, 'Body weight': 0.1 };

const tokCache = new Map<string, string[]>();
const toks = (c: { id: string; en: string }) => {
  let t = tokCache.get(c.id);
  if (!t) { t = c.en.toLowerCase().replace(/\(.*?\)/g, ' ').replace(EQUIP, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w)); tokCache.set(c.id, t); }
  return t;
};
const jaccard = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b); const inter = a.filter((x) => sb.has(x)).length;
  return inter / (a.length + b.length - inter);
};

const EQ_WHY: Record<string, string> = {
  Barbell: 'Heavier loading with a classic bar path.',
  Dumbbell: 'Each side works on its own, with a deeper range of motion.',
  Cable: 'Constant tension through the whole rep.',
  Machine: 'Fixed path that is stable and easy to load.',
  'Body weight': 'No equipment needed, works anywhere.',
  Band: 'Portable, with tension that grows toward the end of the rep.',
  Kettlebell: 'Free weight with a different grip and balance.',
};

const cache = new Map<string, Sub[]>();

/** Até `limit` opções para trocar `base` (a primeira é a mais parecida). `exclude` = ids de catálogo que já estão no treino. */
export function substitutesFor(base: Base, exclude: Set<string>, limit = 4): Sub[] {
  const key = `${base.catalogId ?? base.name}|${limit}|${[...exclude].sort().join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const item = base.catalogId ? CAT_BY_ID.get(base.catalogId) : undefined;
  const target = item?.t ?? base.target ?? '';
  const group = item?.m ?? base.muscle;
  const baseToks = toks({ id: item?.id ?? `custom:${base.name}`, en: item?.en ?? base.name });
  const seen = new Set<string>();
  const pool = CATALOG
    .filter((c) => c.id !== base.catalogId && !exclude.has(c.id) && !SKIP.test(c.en) && !/ v\. \d+$/i.test(c.en) && (target ? c.t === target : c.m === group))
    .map((c) => ({ c, score: jaccard(toks(c), baseToks) * 3 + (c.m === group ? 0.5 : 0) + (c.k === base.kind ? 0.5 : 0) + (EQ_PREF[c.e] ?? 0) }))
    .sort((a, b) => b.score - a.score || a.c.en.length - b.c.en.length);
  const out: Sub[] = [];
  const perEquip: Record<string, number> = {};
  for (const { c } of pool) {
    const sig = `${toks(c).join(' ')}|${c.e}`;
    if (seen.has(sig)) continue;
    // variedade: no máximo 2 do mesmo equipamento, para sempre haver uma saída quando um aparelho está ocupado
    if ((perEquip[c.e] ?? 0) >= 2) continue;
    seen.add(sig);
    perEquip[c.e] = (perEquip[c.e] ?? 0) + 1;
    out.push({ c, closest: out.length === 0, why: `${EQ_WHY[c.e] ?? 'A different tool for the same muscle.'} Same target: ${c.t}.` });
    if (out.length >= limit) break;
  }
  cache.set(key, out);
  return out;
}
