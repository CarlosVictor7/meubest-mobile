/**
 * scheduleRequest — quais solicitações de agendamento o modal deve mostrar.
 *
 * Derivado do snapshot que `useUserSessions` JÁ mantém (consulta
 * `listenerId == uid`): zero listener novo. Uma sessão é solicitação para mim
 * quando:
 *
 *   type === 'scheduled'  — imediatas ficam com o `useIncomingCall`
 *   status === 'pending'  — ainda sem resposta
 *   listenerId === uid    — dirigida a mim (aleatórias, sem listener, não
 *                           aparecem: o cliente não faz claim)
 *   horário não passou    — o worker marca `expired` em ~30 min; até lá, não
 *                           faz sentido pedir aceite de algo que já ficou para trás
 *
 * Função pura.
 */
import { JOIN_WINDOW_AFTER_MS } from './sessionWindow';

export interface ScheduleRequestLike {
  id: string;
  type?: string;
  status?: string;
  listenerId?: string | null;
  selectedTime?: string | null;
  [key: string]: any;
}

export function isPendingScheduleRequest(
  session: ScheduleRequestLike | null | undefined,
  uid: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!session || !uid) return false;
  if (session.type !== 'scheduled') return false;
  if (session.status !== 'pending') return false;
  if (session.listenerId !== uid) return false;

  if (session.selectedTime) {
    const t = Date.parse(session.selectedTime);
    if (!Number.isNaN(t) && now > t + JOIN_WINDOW_AFTER_MS) return false;
  }
  return true;
}

/**
 * Solicitações pendentes para `uid`, da mais próxima para a mais distante.
 * `dismissedIds` são as que a pessoa já fechou nesta instalação.
 */
export function pendingScheduleRequests<T extends ScheduleRequestLike>(
  sessions: T[] | null | undefined,
  uid: string | null | undefined,
  dismissedIds: ReadonlySet<string> | string[] = [],
  now: number = Date.now()
): T[] {
  if (!sessions || !uid) return [];
  const dismissed = dismissedIds instanceof Set ? dismissedIds : new Set(dismissedIds);

  return sessions
    .filter((s) => isPendingScheduleRequest(s, uid, now) && !dismissed.has(s.id))
    .sort((a, b) => {
      const ta = a.selectedTime ? Date.parse(a.selectedTime) : Infinity;
      const tb = b.selectedTime ? Date.parse(b.selectedTime) : Infinity;
      return (Number.isNaN(ta) ? Infinity : ta) - (Number.isNaN(tb) ? Infinity : tb);
    });
}
