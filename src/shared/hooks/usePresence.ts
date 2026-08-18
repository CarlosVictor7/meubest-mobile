/**
 * usePresence — mantém `isOnline` e `lastSeenAt` do usuário em dia.
 *
 * Estratégia deliberadamente econômica:
 *
 *   • O heartbeat só roda quando as TRÊS condições valem ao mesmo tempo —
 *     modo Acolher, chave ligada, app em foreground. Quem está em modo
 *     Desabafar ou offline não gera nenhuma escrita.
 *   • Cada acolhedor ativo escreve ~12 vezes por hora. Barato.
 *   • Ao voltar do background, a marca é renovada imediatamente: quem reabre o
 *     app volta a ser considerado presente sem esperar o próximo tick.
 *
 * O que este hook NÃO faz: marcar alguém offline. Ir para background não é o
 * mesmo que ficar indisponível — o usuário pode estar respondendo uma mensagem.
 * Quem descarta presença obsoleta é o consumidor, via `isPresenceFresh`, e isso
 * funciona mesmo quando o sistema mata o app sem dar chance de escrever nada.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import type { UserProfile } from '@models/user';
import { PRESENCE_HEARTBEAT_MS } from '@shared/utils/presence';
import { canActAsListener } from '@shared/utils/listener';

export function usePresence(
  uid: string | null | undefined,
  profile: UserProfile | null | undefined
): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Evita escritas concorrentes quando foreground e tick coincidem.
  const inFlightRef = useRef(false);

  const shouldTrack = Boolean(uid) && canActAsListener(profile) && profile?.isOnline === true;

  useEffect(() => {
    if (!shouldTrack || !uid) return;

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

    // Marca imediata ao ligar a chave / entrar em modo Acolher.
    touch('start');

    timerRef.current = setInterval(() => touch('heartbeat'), PRESENCE_HEARTBEAT_MS);

    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') touch('foreground');
    };
    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      sub.remove();
    };
  }, [shouldTrack, uid]);
}
