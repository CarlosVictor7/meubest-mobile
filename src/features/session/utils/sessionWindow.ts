/**
 * sessionWindow — quando uma sessão agendada pode ser aberta.
 *
 * ┌── O bug que isto corrige ───────────────────────────────────────────────────┐
 * │ Uma sessão `type: 'scheduled'` marcada para daqui a três dias fica com      │
 * │ `status: 'pending'` desde a criação. As telas ofereciam "ENTRAR NA SALA"    │
 * │ para qualquer sessão pending, sem olhar `selectedTime` — dava para abrir a  │
 * │ sala de uma sessão que ainda nem chegou.                                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌── Modelo de SOLICITAÇÃO (26/08) ────────────────────────────────────────────┐
 * │ `pending` em sessão agendada = solicitação ainda não aceita → NUNCA entra.  │
 * │ `accepted` = confirmada → entra só na janela (−15 / +30 min).               │
 * │ `active` com `startedAt` = alguém já está na sala → entra até o fim da      │
 * │ duração. `active` SEM `startedAt` = doc antigo aceito pelo web legado →     │
 * │ tratado como confirmada (janela), não como "em chamada".                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Sessões `immediate` não têm janela: por definição são agora.
 *
 * Funções puras, sem React nem Firebase.
 */

/** Quanto tempo antes do horário marcado a sala abre. */
export const JOIN_WINDOW_BEFORE_MS = 15 * 60 * 1000;

/** Até quando depois do horário marcado a sala continua acessível. */
export const JOIN_WINDOW_AFTER_MS = 30 * 60 * 1000;

/** Duração assumida quando a sessão não informa `duration`. */
const DEFAULT_DURATION_MIN = 30;

export type JoinReason =
  /** Pode entrar agora. */
  | 'ok'
  /** Ainda não chegou a hora. */
  | 'too_early'
  /** A janela passou. */
  | 'expired'
  /** Solicitação ainda não aceita pelo acolhedor. */
  | 'not_confirmed'
  /** A sessão não está mais disponível (cancelada, concluída, recusada). */
  | 'unavailable';

export interface JoinableSession {
  status?: string;
  type?: string;
  /** ISO 8601 do horário marcado. Só existe em sessões agendadas. */
  selectedTime?: string | null;
  /** Gravado pelo `/join` — presença indica que a chamada começou de fato. */
  startedAt?: unknown;
  /** Minutos. */
  duration?: number | null;
}

export interface JoinDecision {
  canJoin: boolean;
  reason: JoinReason;
  /** Horário marcado em ms, quando há um válido. Útil para formatar a mensagem. */
  scheduledAt: number | null;
}

/** Uma sessão agendada sem horário válido é tratada como imediata. */
function parseScheduledAt(session: JoinableSession): number | null {
  if (!session.selectedTime) return null;
  const t = Date.parse(session.selectedTime);
  return Number.isNaN(t) ? null : t;
}

function hasStarted(session: JoinableSession): boolean {
  return session.startedAt !== undefined && session.startedAt !== null;
}

function durationMs(session: JoinableSession): number {
  const min =
    typeof session.duration === 'number' && session.duration > 0
      ? session.duration
      : DEFAULT_DURATION_MIN;
  return min * 60 * 1000;
}

export function canJoinSession(
  session: JoinableSession | null | undefined,
  now: number = Date.now()
): JoinDecision {
  if (!session) return { canJoin: false, reason: 'unavailable', scheduledAt: null };

  const { status } = session;
  if (status !== 'pending' && status !== 'accepted' && status !== 'active') {
    return { canJoin: false, reason: 'unavailable', scheduledAt: null };
  }

  const scheduledAt = parseScheduledAt(session);

  // Sem horário marcado (ou horário corrompido) = imediata. Sem janela.
  if (session.type !== 'scheduled' || scheduledAt === null) {
    return { canJoin: true, reason: 'ok', scheduledAt };
  }

  // Agendada ainda não aceita: é uma solicitação, não uma sessão.
  if (status === 'pending') {
    return { canJoin: false, reason: 'not_confirmed', scheduledAt };
  }

  // Em chamada de verdade: entra (ou volta) até o fim da duração — sem limite
  // inferior, alguém já está lá dentro.
  if (status === 'active' && hasStarted(session)) {
    const end = scheduledAt + Math.max(JOIN_WINDOW_AFTER_MS, durationMs(session));
    if (now > end) return { canJoin: false, reason: 'expired', scheduledAt };
    return { canJoin: true, reason: 'ok', scheduledAt };
  }

  // `accepted` — ou `active` legado sem `startedAt` — só na janela.
  if (now < scheduledAt - JOIN_WINDOW_BEFORE_MS) {
    return { canJoin: false, reason: 'too_early', scheduledAt };
  }

  if (now > scheduledAt + JOIN_WINDOW_AFTER_MS) {
    return { canJoin: false, reason: 'expired', scheduledAt };
  }

  return { canJoin: true, reason: 'ok', scheduledAt };
}

/**
 * A sessão é uma "próxima sessão" — agendada, ainda por acontecer?
 *
 * Inclui solicitações (`pending`) e confirmadas (`accepted`/`active`); exclui
 * recusadas, expiradas, canceladas e concluídas. Inclui a janela de
 * tolerância: uma sessão que começou há 10 minutos ainda é a próxima da lista.
 */
export function isUpcomingSession(
  session: JoinableSession | null | undefined,
  now: number = Date.now()
): boolean {
  if (!session) return false;
  const { status } = session;
  if (status !== 'pending' && status !== 'accepted' && status !== 'active') return false;
  if (session.type !== 'scheduled') return false;

  const scheduledAt = parseScheduledAt(session);
  if (scheduledAt === null) return false;

  return now <= scheduledAt + JOIN_WINDOW_AFTER_MS;
}

/** Texto curto para o estado do botão quando não dá para entrar. */
export function describeJoinReason(decision: JoinDecision): string {
  switch (decision.reason) {
    case 'ok':
      return 'ENTRAR NA SALA';
    case 'too_early':
      return 'AINDA NÃO ESTÁ NA HORA';
    case 'expired':
      return 'HORÁRIO EXPIRADO';
    case 'not_confirmed':
      return 'AGUARDANDO CONFIRMAÇÃO';
    default:
      return 'INDISPONÍVEL';
  }
}
