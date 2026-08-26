/**
 * sessionStatus — rótulo e cor de cada status de sessão, em UM lugar.
 *
 * Antes cada tela tinha o próprio `STATUS_LABEL` (e `rejected` aparecia como
 * "CANCELADA"). Com o modelo de solicitação, `pending` passa a significar
 * "aguardando o acolhedor confirmar" e entram `accepted` e `expired`.
 *
 * Funções puras.
 */

const STATUS_LABEL: Record<string, string> = {
  pending: 'AGUARDANDO CONFIRMAÇÃO',
  accepted: 'CONFIRMADA',
  active: 'EM ANDAMENTO',
  completed: 'CONCLUÍDA',
  rejected: 'RECUSADA',
  cancelled: 'CANCELADA',
  expired: 'EXPIRADA',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#F97316',
  accepted: '#16A34A',
  active: '#22C55E',
  completed: '#3B82F6',
  rejected: '#9CA3AF',
  cancelled: '#9CA3AF',
  expired: '#9CA3AF',
};

/** Rótulo em caixa alta. Status desconhecido vira ele mesmo em maiúsculas. */
export function sessionStatusLabel(status: string | null | undefined): string {
  if (!status) return STATUS_LABEL.completed;
  return STATUS_LABEL[status] ?? status.toUpperCase();
}

export function sessionStatusColor(status: string | null | undefined): string {
  if (!status) return STATUS_COLOR.completed;
  return STATUS_COLOR[status] ?? '#9CA3AF';
}

/** Sessão agendada que ainda pode ser cancelada por um participante. */
export function isCancellableScheduled(session: {
  type?: string;
  status?: string;
}): boolean {
  return (
    session.type === 'scheduled' &&
    (session.status === 'pending' || session.status === 'accepted')
  );
}
