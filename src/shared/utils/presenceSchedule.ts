/**
 * presenceSchedule — decisão pura do que o heartbeat de presença deve fazer
 * a cada transição de AppState / elegibilidade.
 *
 * Regra (26/08): o heartbeat só existe com o app em FOREGROUND. Em background
 * gravamos UMA última marca (`touch`) e paramos o interval — zero escritas
 * enquanto o app estiver fora de foco. Ao voltar: marca imediata + interval
 * novo. Quem deixa de ser elegível (saiu do modo Acolher, desligou a chave,
 * perdeu a aprovação, fez logout) simplesmente para — sem gravar nada, porque
 * a chave/logout já gravam `isOnline:false` por conta própria.
 *
 * Sem React, sem Firebase, sem timers: só a decisão.
 */

/** Estado de foco relevante para a presença (`AppStateStatus` reduzido). */
export type PresenceFocus = 'active' | 'background' | 'inactive' | 'unknown';

export type PresenceAction = 'start' | 'stop' | 'touch' | 'none';

export interface PresenceEligibility {
  role?: string | null;
  canActAsListener: boolean;
  isOnline?: boolean | null;
}

/**
 * Elegível para heartbeat = modo Acolher + aprovado + chave ligada.
 * As três juntas — quem está em modo Desabafar não escreve nada.
 */
export function isPresenceEligible(e: PresenceEligibility | null | undefined): boolean {
  if (!e) return false;
  return e.role === 'listener' && e.canActAsListener === true && e.isOnline === true;
}

/** Normaliza `AppStateStatus` (que inclui 'extension'/'unknown') no que importa. */
export function toPresenceFocus(status: string | null | undefined): PresenceFocus {
  if (status === 'active') return 'active';
  if (status === 'background') return 'background';
  if (status === 'inactive') return 'inactive';
  return 'unknown';
}

export function isForeground(focus: PresenceFocus): boolean {
  return focus === 'active';
}

/**
 * O que fazer ao sair de `prev` para `next`, dada a elegibilidade atual.
 *
 *   'start' → gravar lastSeenAt agora E iniciar o interval
 *   'touch' → gravar lastSeenAt UMA vez e cancelar o interval (ida ao background)
 *   'stop'  → cancelar o interval (sem gravar)
 *   'none'  → nada
 *
 * `prev = null` é a montagem do hook.
 */
export function decidePresenceAction(
  prev: PresenceFocus | null,
  next: PresenceFocus,
  eligible: boolean
): PresenceAction {
  const wasFg = prev !== null && isForeground(prev);
  const isFg = isForeground(next);

  if (!eligible) {
    // Perdeu a elegibilidade (ou nunca teve): garante o interval parado.
    return wasFg || prev === null ? 'stop' : 'none';
  }

  if (isFg && !wasFg) return 'start'; // montou em foreground / voltou do background
  if (!isFg && wasFg) return 'touch'; // foi para background: última marca + stop
  if (prev === null) return 'stop'; // montou fora de foco: garante interval parado
  return 'none'; // active→active ou background→inactive: nada muda
}
