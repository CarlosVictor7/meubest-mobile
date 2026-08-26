/**
 * usePresence — mantém `lastSeenAt` do usuário em dia.
 *
 * Estratégia deliberadamente econômica (revisada em 26/08):
 *
 *   • O heartbeat só roda quando as TRÊS condições valem ao mesmo tempo —
 *     modo Acolher (`role==='listener'`), aprovado (`canActAsListener`) e
 *     chave ligada (`isOnline===true`). Quem está em modo Desabafar ou offline
 *     não gera nenhuma escrita.
 *   • FOREGROUND: marca imediata + heartbeat a cada 5 min (~12 escritas/hora).
 *   • BACKGROUND/INACTIVE: UMA última marca e o interval é cancelado — zero
 *     heartbeat com o app fora de foco. Ao voltar: marca imediata + interval novo.
 *   • LOGOUT: quem grava `isOnline:false` é o `useAuth.logout`; aqui a
 *     elegibilidade cai e o interval é parado.
 *
 * A decisão (start/touch/stop/none) é pura e testada em
 * `@shared/utils/presenceSchedule`. O que este hook NÃO faz: marcar alguém
 * offline. Quem descarta presença obsoleta é o consumidor, via `isPresenceFresh`.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import type { UserProfile } from '@models/user';
import { PRESENCE_HEARTBEAT_MS } from '@shared/utils/presence';
import { canActAsListener } from '@shared/utils/listener';
import {
  decidePresenceAction,
  isPresenceEligible,
  toPresenceFocus,
  type PresenceFocus,
} from '@shared/utils/presenceSchedule';

export function usePresence(
  uid: string | null | undefined,
  profile: UserProfile | null | undefined
): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Evita escritas concorrentes quando foreground e tick coincidem.
  const inFlightRef = useRef(false);
  // Último foco visto por ESTE ciclo do efeito (null = acabou de montar).
  const focusRef = useRef<PresenceFocus | null>(null);

  const eligible =
    Boolean(uid) &&
    isPresenceEligible({
      role: profile?.role,
      canActAsListener: canActAsListener(profile),
      isOnline: profile?.isOnline,
    });

  useEffect(() => {
    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!eligible || !uid) {
      stopTimer();
      focusRef.current = null;
      return;
    }

    const touch = async (reason: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await updateDoc(doc(db, 'users', uid), {
          lastSeenAt: new Date().toISOString(),
        });
      } catch (error) {
        // Falha de presença nunca deve quebrar a tela. O consumidor tolera
        // marcas com até PRESENCE_STALE_AFTER_MS de atraso.
        console.warn(`[usePresence] Falha ao atualizar lastSeenAt (${reason}):`, error);
      } finally {
        inFlightRef.current = false;
      }
    };

    const startTimer = () => {
      stopTimer();
      timerRef.current = setInterval(() => touch('heartbeat'), PRESENCE_HEARTBEAT_MS);
    };

    const apply = (next: PresenceFocus) => {
      const prev = focusRef.current;
      const action = decidePresenceAction(prev, next, true);
      focusRef.current = next;
      switch (action) {
        case 'start':
          touch(prev === null ? 'start' : 'foreground');
          startTimer();
          break;
        case 'touch':
          touch('background');
          stopTimer();
          break;
        case 'stop':
          stopTimer();
          break;
        default:
          break;
      }
    };

    focusRef.current = null;
    apply(toPresenceFocus(AppState.currentState));

    const sub = AppState.addEventListener('change', (status) => {
      apply(toPresenceFocus(status));
    });

    return () => {
      stopTimer();
      sub.remove();
      focusRef.current = null;
    };
  }, [eligible, uid]);
}
