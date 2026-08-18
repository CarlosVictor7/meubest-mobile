/**
 * listener — quem pode atuar como acolhedor.
 *
 * ┌── PREPARAÇÃO, NÃO FEATURE ──────────────────────────────────────────────────┐
 * │ Neste momento `canActAsListener` reproduz EXATAMENTE o comportamento que o   │
 * │ app já tinha: quem está em modo Acolher pode acolher. Nada muda para nenhum  │
 * │ usuário.                                                                     │
 * │                                                                              │
 * │ O ponto de existir este arquivo é concentrar a decisão em UM lugar. Na       │
 * │ Sprint 6, o enforcement de `listenerStatus` passa a valer trocando a         │
 * │ implementação aqui — e vale em todos os consumidores de uma vez, em vez de   │
 * │ caçar `role === 'listener'` espalhado por meia dúzia de arquivos.            │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Semântica dos dois campos, para não voltarem a se confundir:
 *
 *   role           → o MODO ATUAL (o que a pessoa está fazendo agora)
 *   listenerStatus → a AUTORIZAÇÃO (o que a pessoa pode fazer)
 */
import type { ListenerStatus, UserProfile } from '@models/user';

/** Aceita qualquer objeto com os campos relevantes — inclusive docs crus do Firestore. */
export interface ListenerSource {
  role?: string;
  listenerStatus?: ListenerStatus;
}

/**
 * Status efetivo. Ausência significa `not_requested`: usuários anteriores ao
 * campo nunca solicitaram nada.
 *
 * A ausência é resolvida **na leitura**, nunca por migração de dados — nenhum
 * usuário precisa ser tocado no banco para ser lido corretamente.
 */
export function getListenerStatus(
  profile: ListenerSource | null | undefined
): ListenerStatus {
  return profile?.listenerStatus ?? 'not_requested';
}

/**
 * Pode atuar como acolhedor?
 *
 * ⚠️ Implementação PERMISSIVA — idêntica ao comportamento atual do produto.
 * A Sprint 6 troca por `getListenerStatus(profile) === 'approved'`.
 * Não altere isto isoladamente: o enforcement depende de a migração de
 * grandfathering ter rodado antes, senão todo acolhedor ativo é bloqueado.
 */
export function canActAsListener(
  profile: ListenerSource | null | undefined
): boolean {
  return profile?.role === 'listener';
}

/** Está em modo Acolher agora? Independe de autorização. */
export function isInListenerMode(
  profile: Pick<UserProfile, 'role'> | ListenerSource | null | undefined
): boolean {
  return profile?.role === 'listener';
}
