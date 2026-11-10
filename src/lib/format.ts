import { Units } from './types';
import { getLang, locale } from './i18n';

export const LB = 2.2046226;
export const IN = 0.3937008;

export const toDisplayWeight = (kg: number, u: Units) => (u.weight === 'kg' ? kg : kg * LB);
export const fromDisplayWeight = (v: number, u: Units) => (u.weight === 'kg' ? v : v / LB);
const r1 = (n: number) => Math.round(n * 10) / 10;
export const fmtWeight = (kg: number, u: Units) => `${r1(toDisplayWeight(kg, u))} ${u.weight}`;
export const fmtVolume = (kg: number, u: Units) => {
  const v = toDisplayWeight(kg, u);
  return `${Math.round(v).toLocaleString(locale())} ${u.weight}`;
};
export const MI = 1609.344;
export const toDisplayDist = (m: number, u: Units) => (u.distance === 'mi' ? m / MI : m / 1000);
export const fromDisplayDist = (v: number, u: Units) => (u.distance === 'mi' ? v * MI : v * 1000);
export const fmtDist = (m: number, u: Units) => `${Math.round(toDisplayDist(m, u) * 100) / 100} ${u.distance}`;
export const fmtBody = (cm: number, u: Units) => `${r1(u.body === 'cm' ? cm : cm * IN)} ${u.body}`;
export const toDisplayBody = (cm: number, u: Units) => (u.body === 'cm' ? cm : cm * IN);
export const fromDisplayBody = (v: number, u: Units) => (u.body === 'cm' ? v : v / IN);

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${Math.floor(sec % 60)}s`;
  return `${Math.floor(sec)}s`;
};
/** Duração com segundos sempre (tela do treino e folha Duration): "1h 10min 9s", "3min 17s", "12s". */
export const fmtDurationLive = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}min ${s}s`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mon = (d: Date) => (getLang() === 'pt' ? MON_PT : MON)[d.getMonth()];
/** "6 Nov 2026, 12:06 AM" (pt: "6 nov 2026, 00:06", relógio de 24 h) */
export const fmtStartTime = (d: Date) => {
  const h = d.getHours(), mm = String(d.getMinutes()).padStart(2, '0');
  const time = getLang() === 'pt' ? `${String(h).padStart(2, '0')}:${mm}` : `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  return `${d.getDate()} ${mon(d)} ${d.getFullYear()}, ${time}`;
};
/** "06 Nov 2026" (roda de dias; pt: "06 nov 2026") */
export const fmtDayWheel = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${mon(d)} ${d.getFullYear()}`;
export const fmtRest = (sec: number) => {
  if (!sec) return 'OFF';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m ? `${m}min ` : ''}${s ? `${s}s` : ''}`.trim();
};
export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString(locale(), opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const pt = locale() === 'pt-BR';
  if (m < 1) return pt ? 'agora' : 'now';
  if (m < 60) return pt ? `há ${m} min` : `${m} min ago`;
  if (m < 1440) return pt ? `há ${Math.floor(m / 60)} h` : `${Math.floor(m / 60)} h ago`;
  return pt ? `há ${Math.floor(m / 1440)} d` : `${Math.floor(m / 1440)} d ago`;
};
