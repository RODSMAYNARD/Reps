import { router } from 'expo-router';
import { FEATURES } from './constants';
import { usePro } from './purchases';

/** Limites do plano grátis. O bloqueio só vale com `FEATURES.proGating` ligado (ligar quando os produtos existirem nas lojas). */
export const FREE_LIMITS = { routines: 4 };

/** `allowed('trainer')` → true se pode seguir; senão abre a tela do Pro e devolve false. */
export function useGate() {
  const pro = usePro();
  return (feature: 'routines' | 'trainer' | 'generate', count = 0): boolean => {
    if (!FEATURES.proGating || pro) return true;
    if (feature === 'routines' && count < FREE_LIMITS.routines) return true;
    router.push('/settings/pro');
    return false;
  };
}
