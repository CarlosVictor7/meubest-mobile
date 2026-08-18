import {
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
 * O interruptor nasce desligado. Este teste é a trava: se alguém ligar a flag
 * sem passar pela migração, ele falha e explica o porquê.
 */
describe('LISTENER_APPROVAL_ENFORCED', () => {
  it('está DESLIGADO — ligar exige migração de grandfathering antes', () => {
    expect(LISTENER_APPROVAL_ENFORCED).toBe(false);
  });
});

describe('canActAsListener — enforcement DESLIGADO (estado atual)', () => {
  it('aprova quem está em modo Acolher, sem exigir listenerStatus', () => {
    expect(canActAsListener({ role: 'listener' })).toBe(true);
    expect(canActAsListener({ role: 'listener', listenerStatus: 'not_requested' })).toBe(true);
    expect(canActAsListener({ role: 'listener', listenerStatus: 'rejected' })).toBe(true);
  });

  it('recusa quem não está em modo Acolher', () => {
    expect(canActAsListener({ role: 'speaker' })).toBe(false);
    expect(canActAsListener({})).toBe(false);
    expect(canActAsListener(null)).toBe(false);
  });

  it('NENHUM acolhedor existente é bloqueado — a razão de a flag nascer false', () => {
    // Todo acolhedor de hoje tem role='listener' e nenhum listenerStatus.
    expect(canActAsListener({ role: 'listener' })).toBe(true);
  });

  it('ninguém vê a tela de treinamento enquanto a flag estiver desligada', () => {
    expect(needsListenerTraining({ role: 'speaker' })).toBe(false);
    expect(needsListenerTraining({ role: 'listener' })).toBe(false);
    expect(needsListenerTraining(null)).toBe(false);
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
