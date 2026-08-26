/**
 * Status de sessão.
 *
 * Sessão AGENDADA (`type: 'scheduled'`) é uma SOLICITAÇÃO até o aceite:
 *
 *   pending   → solicitação aguardando o acolhedor
 *   accepted  → confirmada (aceita via API)
 *   active    → em chamada (`/join` grava `startedAt`); docs antigos `active`
 *               sem `startedAt` = confirmada pelo web antigo
 *   completed · cancelled · rejected · expired (worker, +30 min sem resposta)
 *
 * O cliente NUNCA escreve status/listenerId/acceptedAt em sessão agendada —
 * só via `POST /sessions/:id/accept|reject|cancel|join`. Imediatas seguem o
 * fluxo de transação do `useIncomingCall`.
 */
export type SessionStatus =
  | 'pending'
  | 'accepted'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'expired';
export type SessionType = 'immediate' | 'scheduled' | 'specific';

export interface Session {
  id: string;
  speakerId: string;
  listenerId: string | null;
  status: SessionStatus;
  category: string;
  duration: number; // minutes
  type: SessionType;
  createdAt: any; // Firestore Timestamp
  /** ISO 8601 UTC do horário marcado (sessões agendadas). */
  selectedTime?: string;
  /** IANA do device de quem solicitou (ex.: "America/Sao_Paulo"). */
  scheduledTz?: string;
  speakerEmail?: string;
  listenerEmail?: string;
  speakerName?: string;
  listenerName?: string;
  schedulingMode?: 'random' | 'specific';
  price?: number;
  actualDuration?: number;
  completedAt?: any;
  // ── Escritos pela API (transições de agendamento) ───────────────────────
  acceptedAt?: any;
  acceptedBy?: string;
  rejectedAt?: any;
  rejectedBy?: string;
  cancelledAt?: any;
  cancelledBy?: string;
  expiredAt?: any;
  /** Primeiro `/join` da sessão. */
  startedAt?: any;
  /** `/join` por participante: `{ [uid]: timestamp }`. */
  joinedAt?: Record<string, any>;
}

export interface Review {
  id: string;
  sessionId: string;
  fromId: string;
  toId: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
  visibleAt: string;
  createdAt: any;
}

export interface Report {
  id: string;
  sessionId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  comment?: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface Transcript {
  text: string;
  speakerId: string;
  timestamp: any;
}
