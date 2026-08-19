/**
 * listener — quem pode atuar como acolhedor.
 *
 * ┌── ⚠️ LEIA ANTES DE LIGAR O ENFORCEMENT ─────────────────────────────────────┐
 * │                                                                             │
 * │ `LISTENER_APPROVAL_ENFORCED` nasce `false` DE PROPÓSITO.                    │
 * │                                                                             │
 * │ Hoje ninguém tem `listenerStatus` no banco. Ligar o enforcement antes da    │
 * │ migração transformaria TODO acolhedor ativo em bloqueado no mesmo instante: │
 * │ eles sairiam do ar, parariam de receber chamadas e sumiriam do Explorar e   │
 * │ do agendamento — sem aviso e sem culpa.                                     │
 * │                                                                             │
 * │ A ordem de ativação é obrigatória e não pode ser invertida:                 │
 * │                                                                             │
 * │   1. rodar o dry-run  (meubest-api/scripts/migrate-listener-status.ts)      │
 * │   2. REVISÃO HUMANA do relatório                                            │
 * │   3. executar a migração de grandfathering                                  │
 * │   4. conferir a contagem no Console                                         │
 * │   5. só então: ligar esta flag, publicar as Rules e deployar a API          │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Semântica dos dois campos, para não voltarem a se confundir:
 *
 *   role           → o MODO ATUAL (o que a pessoa está fazendo agora)
 *   listenerStatus → a AUTORIZAÇÃO (o que a pessoa pode fazer)
 */
import type { ListenerStatus, UserProfile } from '@models/user';

/**
 * Interruptor único do enforcement de acolhedor.
 *
 * `false` → comportamento idêntico ao que o produto sempre teve.
 * `true`  → só `listenerStatus === 'approved'` pode acolher.
 *
 * Governa **tudo**: o gate de solicitação na UI, a chave Online, o recebimento
 * de chamadas, o Explorar e o agendamento. Um interruptor, um lugar.
 *
 * LIGADA em 19/08/2026 — DEPOIS de: grandfathering aplicado (13 aprovados),
 * Rules Stage 1 publicadas (autoaprovação negada, write-once do carimbo da
 * fila) e flag espelho da API ligada no mesmo ciclo.
 */
export const LISTENER_APPROVAL_ENFORCED = true;

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

/** Está em modo Acolher agora? Independe de autorização. */
export function isInListenerMode(
  profile: Pick<UserProfile, 'role'> | ListenerSource | null | undefined
): boolean {
  return profile?.role === 'listener';
}

/**
 * Pode atuar como acolhedor?
 *
 * Consumido por `useIncomingCall`, `TabHeader`, `HomeScreen`, `ExploreScreen` e
 * `ScheduleMatchScreen`. Trocar o valor da flag muda todos de uma vez — que é o
 * ponto de este helper existir desde a Sprint 2.
 */
export function canActAsListener(
  profile: ListenerSource | null | undefined
): boolean {
  if (!LISTENER_APPROVAL_ENFORCED) {
    return profile?.role === 'listener';
  }
  return getListenerStatus(profile) === 'approved';
}

/**
 * A pessoa deve ver a tela explicativa de treinamento em vez de virar acolhedora?
 *
 * Com o enforcement desligado, ninguém vê — o produto segue como sempre foi.
 */
export function needsListenerTraining(
  profile: ListenerSource | null | undefined
): boolean {
  if (!LISTENER_APPROVAL_ENFORCED) return false;
  return !canActAsListener(profile);
}

/**
 * A única transição que o PRÓPRIO usuário pode fazer.
 *
 * Qualquer outra — inclusive `approved` e `rejected` — é privativa da
 * administração, e as Firestore Rules preparadas nesta sprint garantem isso do
 * lado do servidor. Aqui a checagem é só de UX.
 */
export function canRequestTraining(
  profile: ListenerSource | null | undefined
): boolean {
  return getListenerStatus(profile) === 'not_requested';
}

/**
 * Patch da única transição self. Ver `buildTrainingRequestPatch`.
 * `type` (não `interface`) de propósito: type alias ganha index signature
 * implícita e é aceito direto pelo `updateDoc` do Firestore.
 */
export type TrainingRequestPatch = {
  listenerStatus: 'training_requested';
  /** ISO do aparelho — só informativo, NUNCA é a chave da fila. */
  listenerStatusUpdatedAt: string;
  /** Sentinela serverTimestamp() — a CHAVE DA FILA, carimbada pelo servidor. */
  listenerTrainingRequestedAt: unknown;
  listenerStatusUpdatedBy: string;
};

/**
 * Decide (puro) se a solicitação de treinamento pode ser gravada e monta o
 * patch. `null` = zero write: quem já entrou no ciclo não grava de novo, e o
 * carimbo da fila (`listenerTrainingRequestedAt`) permanece write-once.
 *
 * O sentinela `serverTimestamp()` chega por injeção (`queueStamp`) para este
 * módulo continuar puro e testável sem mock de firebase — e porque a ordem da
 * fila nunca pode depender do relógio do aparelho.
 */
export function buildTrainingRequestPatch(
  profile: ListenerSource | null | undefined,
  args: { uid: string | null | undefined; queueStamp: unknown; nowIso: string }
): TrainingRequestPatch | null {
  if (!args.uid) return null;
  if (!canRequestTraining(profile)) return null;
  return {
    listenerStatus: 'training_requested',
    listenerStatusUpdatedAt: args.nowIso,
    listenerTrainingRequestedAt: args.queueStamp,
    listenerStatusUpdatedBy: args.uid,
  };
}

/** Copy de cada estado do ciclo. Um lugar só, para a UI não divergir. */
export const LISTENER_STATUS_COPY: Record<
  ListenerStatus,
  { title: string; message: string }
> = {
  not_requested: {
    title: 'QUER SE TORNAR UM ACOLHEDOR?',
    message:
      'Acolhedores do Meu Best passam por uma seleção e um treinamento. É assim que cuidamos de quem chega precisando falar — e de quem se dispõe a ouvir.',
  },
  training_requested: {
    title: 'VOCÊ ESTÁ NA FILA',
    message:
      'Quando chegar a sua vez, vamos orientar você sobre as próximas etapas do treinamento.',
  },
  in_training: {
    title: 'TREINAMENTO EM ANDAMENTO',
    message:
      'Continue acompanhando os materiais. Assim que concluir, sua candidatura vai para análise.',
  },
  under_review: {
    title: 'SEU PROCESSO ESTÁ EM ANÁLISE',
    message:
      'Estamos revisando seu treinamento. Avisaremos assim que houver uma resposta.',
  },
  approved: {
    title: 'Você está aprovado para acolher',
    message: 'Vire a chave quando puder ouvir alguém.',
  },
  rejected: {
    title: 'Sua candidatura não foi aprovada desta vez',
    message:
      'Isso não impede você de usar o Meu Best para desabafar sempre que precisar. Se quiser entender melhor, fale com a gente pelo suporte.',
  },
};
