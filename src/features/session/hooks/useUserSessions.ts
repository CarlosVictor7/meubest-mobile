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
 * O `limit` é aplicado por consulta e depois de novo sobre o merge, senão o
 * resultado poderia ficar enviesado para o papel com mais sessões.
 */
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit as fsLimit, onSnapshot } from 'firebase/firestore';
import { db } from '@shared/services/firebase';
import { mergeSessions, type SessionLike } from '@features/session/utils/sessionFilters';

interface UseUserSessionsResult {
  sessions: SessionLike[];
  loading: boolean;
  /** true quando as DUAS consultas falharam — uma sozinha não zera a lista. */
  error: boolean;
}

export function useUserSessions(
  uid: string | null | undefined,
  perQueryLimit = 30
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

  return {
    sessions: loading ? [] : mergeSessions(asSpeaker, asListener).slice(0, perQueryLimit),
    loading,
    error: speakerFailed && listenerFailed,
  };
}
