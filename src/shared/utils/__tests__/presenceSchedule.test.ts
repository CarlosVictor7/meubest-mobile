/**
 * presenceSchedule — heartbeat só em foreground; background = 1 marca + stop.
 */
import {
  decidePresenceAction,
  isPresenceEligible,
  toPresenceFocus,
} from '../presenceSchedule';

const listenerOn = { role: 'listener', canActAsListener: true, isOnline: true };

describe('isPresenceEligible', () => {
  it('exige modo Acolher + aprovação + chave ligada', () => {
    expect(isPresenceEligible(listenerOn)).toBe(true);
  });

  it('modo Desabafar nunca gera heartbeat, mesmo aprovado e online', () => {
    expect(isPresenceEligible({ ...listenerOn, role: 'speaker' })).toBe(false);
  });

  it('não aprovado não gera heartbeat', () => {
    expect(isPresenceEligible({ ...listenerOn, canActAsListener: false })).toBe(false);
  });

  it('chave desligada / ausente não gera heartbeat', () => {
    expect(isPresenceEligible({ ...listenerOn, isOnline: false })).toBe(false);
    expect(isPresenceEligible({ ...listenerOn, isOnline: undefined })).toBe(false);
    expect(isPresenceEligible(null)).toBe(false);
  });
});

describe('toPresenceFocus', () => {
  it('mapeia AppStateStatus e trata o resto como unknown', () => {
    expect(toPresenceFocus('active')).toBe('active');
    expect(toPresenceFocus('background')).toBe('background');
    expect(toPresenceFocus('inactive')).toBe('inactive');
    expect(toPresenceFocus('extension')).toBe('unknown');
    expect(toPresenceFocus(undefined)).toBe('unknown');
  });
});

describe('decidePresenceAction', () => {
  it('montagem em foreground, elegível → start (write imediato + interval)', () => {
    expect(decidePresenceAction(null, 'active', true)).toBe('start');
  });

  it('foreground → background: uma última marca (touch) e o interval cai', () => {
    expect(decidePresenceAction('active', 'background', true)).toBe('touch');
    expect(decidePresenceAction('active', 'inactive', true)).toBe('touch');
  });

  it('background → inactive (ou vice-versa): nada — zero heartbeat fora de foco', () => {
    expect(decidePresenceAction('background', 'inactive', true)).toBe('none');
    expect(decidePresenceAction('inactive', 'background', true)).toBe('none');
  });

  it('voltar ao foreground → start de novo (write + novo interval)', () => {
    expect(decidePresenceAction('background', 'active', true)).toBe('start');
    expect(decidePresenceAction('inactive', 'active', true)).toBe('start');
  });

  it('active → active (evento repetido) → none: sem write duplicado', () => {
    expect(decidePresenceAction('active', 'active', true)).toBe('none');
  });

  it('montagem em background, elegível → stop (não escreve até ter foco)', () => {
    expect(decidePresenceAction(null, 'background', true)).toBe('stop');
  });

  it('não elegível (não-listener / não-aprovado / logout) → stop a partir do foreground', () => {
    expect(decidePresenceAction('active', 'active', false)).toBe('stop');
    expect(decidePresenceAction(null, 'active', false)).toBe('stop');
  });

  it('não elegível já fora do foreground → none (nada a parar, nada a gravar)', () => {
    expect(decidePresenceAction('background', 'background', false)).toBe('none');
    expect(decidePresenceAction('background', 'active', false)).toBe('none');
  });
});
