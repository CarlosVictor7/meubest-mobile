import {
  sessionStatusLabel,
  sessionStatusColor,
  isCancellableScheduled,
} from '../sessionStatus';

describe('sessionStatusLabel', () => {
  it('mapeia todos os status do modelo de solicitação', () => {
    expect(sessionStatusLabel('pending')).toBe('AGUARDANDO CONFIRMAÇÃO');
    expect(sessionStatusLabel('accepted')).toBe('CONFIRMADA');
    expect(sessionStatusLabel('active')).toBe('EM ANDAMENTO');
    expect(sessionStatusLabel('completed')).toBe('CONCLUÍDA');
    expect(sessionStatusLabel('rejected')).toBe('RECUSADA');
    expect(sessionStatusLabel('cancelled')).toBe('CANCELADA');
    expect(sessionStatusLabel('expired')).toBe('EXPIRADA');
  });

  it('recusada NÃO é mais rotulada como cancelada', () => {
    expect(sessionStatusLabel('rejected')).not.toBe(sessionStatusLabel('cancelled'));
  });

  it('desconhecido vira maiúsculas; vazio cai em concluída (histórico legado)', () => {
    expect(sessionStatusLabel('weird')).toBe('WEIRD');
    expect(sessionStatusLabel(undefined)).toBe('CONCLUÍDA');
    expect(sessionStatusLabel(null)).toBe('CONCLUÍDA');
  });
});

describe('sessionStatusColor', () => {
  it('tem cor para cada status e fallback cinza', () => {
    for (const s of ['pending', 'accepted', 'active', 'completed', 'rejected', 'cancelled', 'expired']) {
      expect(sessionStatusColor(s)).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(sessionStatusColor('x')).toBe('#9CA3AF');
  });
});

describe('isCancellableScheduled', () => {
  it('só agendada pending/accepted', () => {
    expect(isCancellableScheduled({ type: 'scheduled', status: 'pending' })).toBe(true);
    expect(isCancellableScheduled({ type: 'scheduled', status: 'accepted' })).toBe(true);
    expect(isCancellableScheduled({ type: 'scheduled', status: 'active' })).toBe(false);
    expect(isCancellableScheduled({ type: 'scheduled', status: 'completed' })).toBe(false);
    expect(isCancellableScheduled({ type: 'immediate', status: 'pending' })).toBe(false);
  });
});
