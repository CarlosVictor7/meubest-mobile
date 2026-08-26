/**
 * useUserSessions — todas as sessões em que o usuário participou, em qualquer papel.
 *
 * Duas consultas independentes (`speakerId == uid` e `listenerId == uid`) unidas
 * no cliente. Substitui o ternário que escolhia o campo pelo papel ATUAL e fazia
 * metade do histórico sumir quando a pessoa alternava entre Desabafar e Acolher.
 *
 * Por que não mudar o modelo (ex.: `participantIds` com `array-contains`):
 * exigiria migrar todas as sessões existentes. Os dois índices compostos que
 * esta abordagem usa — `(speakerId, createdAt)` e `(listenerId, createdAt)` —
 * já são exercitados hoje, cada um em um ramo do ternário que estamos removendo.
 *
 * ┌── Por que o limite subiu de 30 para 300 ────────────────────────────────────┐
 * │ O limite antigo escondia dados de verdade, não só "as mais antigas".        │
 * │                                                                             │
 * │ Medido em produção (leitura, conta real): 114 sessões, 54 concluídas — e a  │
 * │ tela mostrava 13. A consulta trazia as 30 mais recentes por `createdAt`, e  │
 * │ 58 das 114 estão `cancelled`. Como o histórico só exibe `completed`, o      │
 * │ limite era gasto majoritariamente com sessões que a tela descartaria, e 41  │
 * │ sessões concluídas ficavam inalcançáveis — sem botão e sem aviso.           │
 * │                                                                             │
 * │ Filtrar `status == 'completed'` na própria consulta resolveria com menos    │
 * │ leituras, mas exigiria um índice composto novo — deploy de infraestrutura   │
 * │ fora do escopo desta correção. Ver ASSUMPTION-01 no walkthrough.            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * O corte pós-merge foi removido: ele reaplicava o limite sobre a UNIÃO dos dois
 * papéis, então quem tinha muitas sessões em cada papel perdia parte das duas
 * listas depois de a consulta já as ter trazido — pagando a leitura e jogando
 * fora o resultado.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, orderBy, limit as fsLimit, onSnapshot } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { mergeSessions, type SessionLike } from '@features/session/utils/sessionFilters';
import { useUserSessionsStore } from '@features/session/stores/userSessionsStore';

interface UseUserSessionsResult {
  sessions: SessionLike[];
  loading: boolean;
  /** true quando as DUAS consultas falharam — uma sozinha não zera a lista. */
  error: boolean;
}

export function useUserSessions(
  uid: string | null | undefined,
  perQueryLimit = 300
): UseUserSessionsResult {
  const [asSpeaker, setAsSpeaker] = useState<SessionLike[] | null>(null);
  const [asListener, setAsListener] = useState<SessionLike[] | null>(null);
  const [speakerFailed, setSpeakerFailed] = useState(false);
  const [listenerFailed, setListenerFailed] = useState(false);

  useEffect(() => {
    if (!uid) {
      setAsSpeaker([]);
      setAsListener([]);
      return;
    }

    setAsSpeaker(null);
    setAsListener(null);
    setSpeakerFailed(false);
    setListenerFailed(false);

    const subscribe = (
      field: 'speakerId' | 'listenerId',
      onData: (rows: SessionLike[]) => void,
      onFail: () => void
    ) =>
      onSnapshot(
        query(
          collection(db, 'sessions'),
          where(field, '==', uid),
          orderBy('createdAt', 'desc'),
          fsLimit(perQueryLimit)
        ),
        (snap) => {
          onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SessionLike));
        },
        (err) => {
          console.warn(`[useUserSessions] Falha na consulta por ${field}:`, err);
          // Lista vazia em vez de null: uma consulta que falhou não pode deixar
          // a tela em "carregando" para sempre nem apagar o que a outra trouxe.
          onData([]);
          onFail();
        }
      );

    const unsubSpeaker = subscribe('speakerId', setAsSpeaker, () => setSpeakerFailed(true));
    const unsubListener = subscribe('listenerId', setAsListener, () => setListenerFailed(true));

    return () => {
      unsubSpeaker();
      unsubListener();
    };
  }, [uid, perQueryLimit]);

  const loading = asSpeaker === null || asListener === null;
  const sessions = useMemo(
    () => (loading ? [] : mergeSessions(asSpeaker, asListener)),
    [loading, asSpeaker, asListener]
  );

  // Publica o snapshot para quem não pode abrir listener próprio (modal de
  // solicitação no AppTabNavigator). Ver userSessionsStore.
  useEffect(() => {
    if (!uid || loading) return;
    useUserSessionsStore.getState().setSessions(uid, sessions);
  }, [uid, loading, sessions]);

  return {
    sessions,
    loading,
    error: speakerFailed && listenerFailed,
  };
}
