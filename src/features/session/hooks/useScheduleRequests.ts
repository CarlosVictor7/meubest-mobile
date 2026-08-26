/**
 * useScheduleRequests — solicitações de agendamento dirigidas a mim.
 *
 * Deriva do snapshot compartilhado (`userSessionsStore`, alimentado pelo
 * `useUserSessions` da Home) — NENHUM onSnapshot novo. A filtragem é a função
 * pura `pendingScheduleRequests`. Aceitar/recusar vai pela API; o snapshot
 * traz o status novo e a solicitação some sozinha.
 *
 * Dismiss (fechar sem responder) é por sessionId em AsyncStorage: sobrevive a
 * cold start e não reabre a mesma solicitação a cada foreground. Uma
 * solicitação nova (id diferente) sempre aparece.
 *
 * Imediatas NUNCA chegam aqui: o filtro exige `type === 'scheduled'`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserSessionsStore, selectSessionsFor } from '../stores/userSessionsStore';
import { pendingScheduleRequests } from '../utils/scheduleRequest';
import type { SessionLike } from '../utils/sessionFilters';
import {
  acceptScheduledSession,
  rejectScheduledSession,
  SchedulingError,
} from '../services/scheduling';

const DISMISSED_KEY = '@meubest:scheduleRequestsDismissed';
/** Guarda só os últimos N ids — o resto já virou passado. */
const DISMISSED_CAP = 50;

export type ScheduleRequestAction = 'accept' | 'reject' | null;

export interface UseScheduleRequestsResult {
  /** A solicitação mais próxima ainda não respondida nem dispensada. */
  request: SessionLike | null;
  /** Qual ação está em voo (guard de duplo toque). */
  busy: ScheduleRequestAction;
  accept: (sessionId: string) => Promise<void>;
  reject: (sessionId: string) => Promise<void>;
  dismiss: (sessionId: string) => void;
}

export function useScheduleRequests(uid: string | null | undefined): UseScheduleRequestsResult {
  const sessions = useUserSessionsStore(selectSessionsFor(uid));
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<ScheduleRequestAction>(null);
  const inFlightRef = useRef(false);

  // Hidrata a lista de dispensadas uma vez.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISSED_KEY);
        const ids: unknown = raw ? JSON.parse(raw) : [];
        if (alive) setDismissed(new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []));
      } catch {
        if (alive) setDismissed(new Set());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persistDismissed = useCallback((next: Set<string>) => {
    const arr = Array.from(next).slice(-DISMISSED_CAP);
    AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(arr)).catch(() => {
      // best-effort — no pior caso o modal reabre no próximo cold start
    });
  }, []);

  const dismiss = useCallback(
    (sessionId: string) => {
      setDismissed((prev) => {
        const next = new Set(prev ?? []);
        next.add(sessionId);
        persistDismissed(next);
        return next;
      });
    },
    [persistDismissed]
  );

  const request = useMemo(() => {
    // Enquanto não sabemos o que já foi dispensado, não mostramos nada —
    // evita o flash de uma solicitação que a pessoa já fechou.
    if (dismissed === null) return null;
    return pendingScheduleRequests(sessions, uid, dismissed)[0] ?? null;
  }, [sessions, uid, dismissed]);

  const runAction = useCallback(
    async (action: 'accept' | 'reject', sessionId: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(action);
      try {
        if (action === 'accept') await acceptScheduledSession(sessionId);
        else await rejectScheduledSession(sessionId);
        // O snapshot vai trocar o status; dispensar garante que não reapareça
        // no intervalo (ou se o status já tinha mudado por fora).
        dismiss(sessionId);
      } catch (err) {
        if (err instanceof SchedulingError && (err.statusCode === 404 || err.statusCode === 409)) {
          // Já respondida/cancelada: some do modal também.
          dismiss(sessionId);
        }
        throw err;
      } finally {
        inFlightRef.current = false;
        setBusy(null);
      }
    },
    [dismiss]
  );

  const accept = useCallback((id: string) => runAction('accept', id), [runAction]);
  const reject = useCallback((id: string) => runAction('reject', id), [runAction]);

  return { request, busy, accept, reject, dismiss };
}
