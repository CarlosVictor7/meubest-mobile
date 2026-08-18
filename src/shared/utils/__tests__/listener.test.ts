import { canActAsListener, getListenerStatus, isInListenerMode } from '../listener';

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
});

/**
 * ⚠️ Estes testes descrevem o comportamento PERMISSIVO da Sprint 2.
 *
 * Quando a Sprint 6 trocar a implementação por
 * `getListenerStatus(profile) === 'approved'`, este bloco DEVE falhar — é essa
 * falha que prova que o enforcement entrou em vigor. Reescrever os casos junto
 * com a mudança, não antes.
 */
describe('canActAsListener — PREPARAÇÃO (permissivo até a Sprint 6)', () => {
  it('aprova quem está em modo Acolher, sem exigir listenerStatus', () => {
    expect(canActAsListener({ role: 'listener' })).toBe(true);
    expect(canActAsListener({ role: 'listener', listenerStatus: 'not_requested' })).toBe(true);
    expect(canActAsListener({ role: 'listener', listenerStatus: 'rejected' })).toBe(true);
  });

  it('recusa quem não está em modo Acolher', () => {
    expect(canActAsListener({ role: 'speaker' })).toBe(false);
    expect(canActAsListener({ role: 'speaker', listenerStatus: 'approved' })).toBe(false);
    expect(canActAsListener({})).toBe(false);
    expect(canActAsListener(null)).toBe(false);
    expect(canActAsListener(undefined)).toBe(false);
  });

  it('nenhum acolhedor existente é bloqueado — o ponto da preparação', () => {
    // Todo usuário que hoje acolhe tem role='listener' e nenhum listenerStatus.
    const acolhedorAtual = { role: 'listener' };
    expect(canActAsListener(acolhedorAtual)).toBe(true);
  });
});
