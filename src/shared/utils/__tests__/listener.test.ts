import {
  buildTrainingRequestPatch,
  canActAsListener,
  canRequestTraining,
  getListenerStatus,
  isInListenerMode,
  needsListenerTraining,
  LISTENER_APPROVAL_ENFORCED,
  LISTENER_STATUS_COPY,
} from '../listener';

describe('getListenerStatus', () => {
  it('devolve o status quando existe', () => {
    expect(getListenerStatus({ listenerStatus: 'approved' })).toBe('approved');
    expect(getListenerStatus({ listenerStatus: 'rejected' })).toBe('rejected');
    expect(getListenerStatus({ listenerStatus: 'in_training' })).toBe('in_training');
  });

  it('trata ausência como not_requested — sem migrar ninguém', () => {
    expect(getListenerStatus({})).toBe('not_requested');
    expect(getListenerStatus({ role: 'listener' })).toBe('not_requested');
    expect(getListenerStatus(null)).toBe('not_requested');
    expect(getListenerStatus(undefined)).toBe('not_requested');
  });
});

describe('isInListenerMode', () => {
  it('olha apenas o modo atual, nunca a autorização', () => {
    expect(isInListenerMode({ role: 'listener' })).toBe(true);
    expect(isInListenerMode({ role: 'speaker' })).toBe(false);
    expect(isInListenerMode({ role: 'admin' })).toBe(false);
    expect(isInListenerMode(null)).toBe(false);
  });

  it('não confunde autorização com modo', () => {
    // Aprovado mas em modo Desabafar: não está acolhendo agora.
    expect(isInListenerMode({ role: 'speaker', listenerStatus: 'approved' })).toBe(false);
  });
});

/**
 * A trava mudou de lado em 19/08/2026: a flag foi LIGADA depois de cumprida a
 * ordem (grandfathering aplicado — 13 aprovados — e Rules Stage 1 publicadas
 * negando autoaprovação). Se alguém desligar sem intenção, este teste falha.
 */
describe('LISTENER_APPROVAL_ENFORCED', () => {
  it('está LIGADO — grandfathering + Rules Stage 1 publicados em 19/08', () => {
    expect(LISTENER_APPROVAL_ENFORCED).toBe(true);
  });
});

describe('canActAsListener — enforcement LIGADO', () => {
  it('aprova SOMENTE listenerStatus approved (role é só o modo)', () => {
    expect(canActAsListener({ role: 'listener', listenerStatus: 'approved' })).toBe(true);
    expect(canActAsListener({ role: 'speaker', listenerStatus: 'approved' })).toBe(true);
  });

  it('modo Acolher sem aprovação NÃO basta mais', () => {
    expect(canActAsListener({ role: 'listener' })).toBe(false);
    expect(canActAsListener({ role: 'listener', listenerStatus: 'not_requested' })).toBe(false);
    expect(canActAsListener({ role: 'listener', listenerStatus: 'rejected' })).toBe(false);
  });

  it('vazio/nulo não passa', () => {
    expect(canActAsListener({})).toBe(false);
    expect(canActAsListener(null)).toBe(false);
  });

  it('grandfathered continuam funcionando (a razão da migração vir antes)', () => {
    // Todo acolhedor pré-existente recebeu listenerStatus='approved' na migração.
    expect(canActAsListener({ role: 'listener', listenerStatus: 'approved' })).toBe(true);
  });

  it('tela de treinamento aparece para quem toca Acolher sem aprovação', () => {
    expect(needsListenerTraining({ role: 'speaker' })).toBe(true);
    expect(needsListenerTraining({ role: 'listener' })).toBe(true);
    expect(needsListenerTraining({ role: 'listener', listenerStatus: 'approved' })).toBe(false);
    expect(needsListenerTraining(null)).toBe(true);
  });
});

describe('canRequestTraining', () => {
  it('só quem nunca solicitou pode solicitar', () => {
    expect(canRequestTraining({})).toBe(true);
    expect(canRequestTraining({ role: 'speaker' })).toBe(true);
  });

  it('quem já está no ciclo não solicita de novo', () => {
    for (const status of ['training_requested', 'in_training', 'under_review', 'approved', 'rejected'] as const) {
      expect(canRequestTraining({ listenerStatus: status })).toBe(false);
    }
  });
});

describe('buildTrainingRequestPatch — idempotência da solicitação', () => {
  const args = { uid: 'user-1', queueStamp: { sentinel: 'serverTimestamp' }, nowIso: '2026-08-19T12:00:00.000Z' };

  it('monta o patch completo para quem nunca solicitou', () => {
    expect(buildTrainingRequestPatch({}, args)).toEqual({
      listenerStatus: 'training_requested',
      listenerStatusUpdatedAt: '2026-08-19T12:00:00.000Z',
      listenerTrainingRequestedAt: { sentinel: 'serverTimestamp' },
      listenerStatusUpdatedBy: 'user-1',
    });
    expect(buildTrainingRequestPatch({ role: 'speaker' }, args)).not.toBeNull();
    expect(buildTrainingRequestPatch({ listenerStatus: 'not_requested' }, args)).not.toBeNull();
  });

  it('devolve null para quem já entrou no ciclo — clique repetido = ZERO write', () => {
    // O carimbo da fila (serverTimestamp) é write-once: qualquer status fora
    // de not_requested significa que ele já existe e não pode ser regravado.
    for (const status of ['training_requested', 'in_training', 'under_review', 'approved', 'rejected'] as const) {
      expect(buildTrainingRequestPatch({ listenerStatus: status }, args)).toBeNull();
    }
  });

  it('devolve null sem uid — nunca grava às cegas', () => {
    expect(buildTrainingRequestPatch({}, { ...args, uid: null })).toBeNull();
    expect(buildTrainingRequestPatch({}, { ...args, uid: undefined })).toBeNull();
    expect(buildTrainingRequestPatch({}, { ...args, uid: '' })).toBeNull();
  });

  it('o carimbo da fila é o sentinela injetado, nunca um relógio local', () => {
    const stamp = Symbol('serverTimestamp');
    const patch = buildTrainingRequestPatch({}, { ...args, queueStamp: stamp });
    expect(patch?.listenerTrainingRequestedAt).toBe(stamp);
  });
});

describe('LISTENER_STATUS_COPY', () => {
  it('cobre os seis estados', () => {
    const estados = [
      'not_requested',
      'training_requested',
      'in_training',
      'under_review',
      'approved',
      'rejected',
    ] as const;
    for (const e of estados) {
      expect(LISTENER_STATUS_COPY[e].title.length).toBeGreaterThan(0);
      expect(LISTENER_STATUS_COPY[e].message.length).toBeGreaterThan(0);
    }
  });

  it('a mensagem de reprovação não fecha a porta do app', () => {
    // Quem não foi aprovado para acolher continua podendo desabafar.
    expect(LISTENER_STATUS_COPY.rejected.message.toLowerCase()).toContain('desabafar');
  });
});
