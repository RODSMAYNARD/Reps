import { Units } from './types';

export const LB = 2.2046226;
export const IN = 0.3937008;

export const toDisplayWeight = (kg: number, u: Units) => (u.weight === 'kg' ? kg : kg * LB);
export const fromDisplayWeight = (v: number, u: Units) => (u.weight === 'kg' ? v : v / LB);
const r1 = (n: number) => Math.round(n * 10) / 10;
export const fmtWeight = (kg: number, u: Units) => `${r1(toDisplayWeight(kg, u))} ${u.weight}`;
export const fmtVolume = (kg: number, u: Units) => {
  const v = toDisplayWeight(kg, u);
  return `${Math.round(v).toLocaleString('pt-BR')} ${u.weight}`;
};
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
export const fmtRest = (sec: number) => {
  if (!sec) return 'DESLIGADO';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m ? `${m}min ` : ''}${s ? `${s}s` : ''}`.trim();
};
export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString('pt-BR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.floor(m / 60)} h`;
  return `há ${Math.floor(m / 1440)} d`;
};
