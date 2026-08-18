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
 * Sessões `immediate` não têm janela: por definição são agora.
 *
 * Funções puras, sem React nem Firebase — este é o helper mais testável e mais
 * fácil de errar da sprint, então tem cobertura de todos os limites.
 */

/** Quanto tempo antes do horário marcado a sala abre. */
export const JOIN_WINDOW_BEFORE_MS = 15 * 60 * 1000;

/** Até quando depois do horário marcado a sala continua acessível. */
export const JOIN_WINDOW_AFTER_MS = 30 * 60 * 1000;

export type JoinReason =
  /** Pode entrar agora. */
  | 'ok'
  /** Ainda não chegou a hora. */
  | 'too_early'
  /** A janela passou. */
  | 'expired'
  /** A sessão não está mais disponível (cancelada, concluída, recusada). */
  | 'unavailable';

export interface JoinableSession {
  status?: string;
  type?: string;
  /** ISO 8601 do horário marcado. Só existe em sessões agendadas. */
  selectedTime?: string | null;
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

export function canJoinSession(
  session: JoinableSession | null | undefined,
  now: number = Date.now()
): JoinDecision {
  if (!session) return { canJoin: false, reason: 'unavailable', scheduledAt: null };

  // Só faz sentido entrar em sessão que está esperando ou já rolando.
  if (session.status !== 'pending' && session.status !== 'active') {
    return { canJoin: false, reason: 'unavailable', scheduledAt: null };
  }

  // Sessão já ativa: alguém está lá dentro. Entrar é sempre permitido,
  // independentemente do horário que estava marcado.
  if (session.status === 'active') {
    return { canJoin: true, reason: 'ok', scheduledAt: parseScheduledAt(session) };
  }

  const scheduledAt = parseScheduledAt(session);

  // Sem horário marcado (ou horário corrompido) = imediata. Sem janela.
  if (session.type !== 'scheduled' || scheduledAt === null) {
    return { canJoin: true, reason: 'ok', scheduledAt };
  }

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
 * Inclui a janela de tolerância: uma sessão que começou há 10 minutos ainda é
 * a próxima da lista, não passado.
 */
export function isUpcomingSession(
  session: JoinableSession | null | undefined,
  now: number = Date.now()
): boolean {
  if (!session) return false;
  if (session.status !== 'pending' && session.status !== 'active') return false;
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
    default:
      return 'INDISPONÍVEL';
  }
}
