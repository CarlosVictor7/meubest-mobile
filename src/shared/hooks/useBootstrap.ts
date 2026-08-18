/**
 * useBootstrap — o portão único de inicialização do app.
 *
 * ┌── O problema que isto resolve ──────────────────────────────────────────────┐
 * │ Antes existiam três decisões assíncronas independentes, cada uma com o seu  │
 * │ próprio "ainda não sei":                                                    │
 * │                                                                             │
 * │   1. authStore.loading nascia false      → 1º frame montava o login         │
 * │   2. persist do Zustand hidratava depois → profile null por alguns frames   │
 * │   3. AuthNavigator lia o AsyncStorage    → segundo spinner                   │
 * │                                                                             │
 * │ O resultado era: Auth (1 frame) → spinner → spinner → App.                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Agora as três resolvem em paralelo e o app só decide quando todas terminaram.
 * Não há delay artificial em lugar nenhum: o portão abre no instante em que a
 * última das três responde.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@shared/stores/authStore';

/** Chave gravada pelo OnboardingScreen ao concluir a apresentação. */
export const ONBOARDING_SEEN_KEY = '@meubest:onboarding_seen';

export interface BootstrapState {
  /** false enquanto qualquer uma das três decisões ainda estiver pendente. */
  isReady: boolean;
  /**
   * true quando o usuário nunca viu o onboarding.
   * Só é significativo quando `isReady` é true.
   */
  isFirstLaunch: boolean;
}

export function useBootstrap(): BootstrapState {
  const loading = useAuthStore((s) => s.loading);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((value) => {
        if (!active) return;
        setIsFirstLaunch(value !== 'true');
      })
      .catch((error) => {
        // Na dúvida, mostrar o onboarding: é inofensivo para quem já viu e
        // necessário para quem não viu.
        console.warn('[useBootstrap] Falha ao ler onboarding_seen:', error);
        if (active) setIsFirstLaunch(true);
      })
      .finally(() => {
        if (active) setOnboardingResolved(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    isReady: !loading && hasHydrated && onboardingResolved,
    isFirstLaunch,
  };
}
