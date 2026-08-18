import {
  canJoinSession,
  isUpcomingSession,
  describeJoinReason,
  JOIN_WINDOW_BEFORE_MS,
  JOIN_WINDOW_AFTER_MS,
} from '../sessionWindow';

const NOW = Date.parse('2026-08-18T15:00:00.000Z');
/** Horário marcado, deslocado em ms a partir de NOW. */
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const scheduled = (offsetMs: number, status = 'pending') => ({
  status,
  type: 'scheduled',
  selectedTime: at(offsetMs),
});

describe('canJoinSession — sessão agendada', () => {
  it('recusa muito antes do horário', () => {
    const d = canJoinSession(scheduled(3 * 60 * 60 * 1000), NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('too_early');
  });

  it('recusa 1 ms antes de abrir a janela', () => {
    const d = canJoinSession(scheduled(JOIN_WINDOW_BEFORE_MS + 1), NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('too_early');
  });

  it('aceita exatamente quando a janela abre', () => {
    const d = canJoinSession(scheduled(JOIN_WINDOW_BEFORE_MS), NOW);
    expect(d.canJoin).toBe(true);
    expect(d.reason).toBe('ok');
  });

  it('aceita no horário marcado', () => {
    expect(canJoinSession(scheduled(0), NOW).canJoin).toBe(true);
  });

  it('aceita dentro da tolerância depois do horário', () => {
    expect(canJoinSession(scheduled(-10 * 60 * 1000), NOW).canJoin).toBe(true);
  });

  it('aceita exatamente no limite da tolerância', () => {
    expect(canJoinSession(scheduled(-JOIN_WINDOW_AFTER_MS), NOW).canJoin).toBe(true);
  });

  it('recusa 1 ms depois da tolerância', () => {
    const d = canJoinSession(scheduled(-JOIN_WINDOW_AFTER_MS - 1), NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('expired');
  });

  it('devolve o horário marcado para a UI formatar', () => {
    const d = canJoinSession(scheduled(60 * 60 * 1000), NOW);
    expect(d.scheduledAt).toBe(NOW + 60 * 60 * 1000);
  });
});

describe('canJoinSession — sessão imediata', () => {
  it('não tem janela: entra sempre', () => {
    expect(canJoinSession({ status: 'pending', type: 'immediate' }, NOW).canJoin).toBe(true);
  });

  it('ignora selectedTime em sessão imediata', () => {
    const d = canJoinSession(
      { status: 'pending', type: 'immediate', selectedTime: at(5 * 60 * 60 * 1000) },
      NOW
    );
    expect(d.canJoin).toBe(true);
  });
});

describe('canJoinSession — casos de borda', () => {
  it('sessão ativa entra mesmo fora da janela', () => {
    const d = canJoinSession(scheduled(-5 * 60 * 60 * 1000, 'active'), NOW);
    expect(d.canJoin).toBe(true);
    expect(d.reason).toBe('ok');
  });

  it('recusa sessão concluída, cancelada ou recusada', () => {
    for (const status of ['completed', 'cancelled', 'rejected']) {
      const d = canJoinSession({ ...scheduled(0), status }, NOW);
      expect(d.canJoin).toBe(false);
      expect(d.reason).toBe('unavailable');
    }
  });

  it('agendada sem selectedTime é tratada como imediata', () => {
    expect(canJoinSession({ status: 'pending', type: 'scheduled' }, NOW).canJoin).toBe(true);
  });

  it('agendada com selectedTime corrompido é tratada como imediata', () => {
    const d = canJoinSession(
      { status: 'pending', type: 'scheduled', selectedTime: 'amanhã de manhã' },
      NOW
    );
    expect(d.canJoin).toBe(true);
    expect(d.scheduledAt).toBeNull();
  });

  it('recusa sessão nula', () => {
    expect(canJoinSession(null, NOW).canJoin).toBe(false);
    expect(canJoinSession(undefined, NOW).reason).toBe('unavailable');
  });

  it('o caso que motivou o helper: agendada para daqui a 3 dias', () => {
    const daquiA3Dias = scheduled(3 * 24 * 60 * 60 * 1000);
    // Status é 'pending' desde a criação — era isso que liberava o botão antes.
    expect(daquiA3Dias.status).toBe('pending');
    expect(canJoinSession(daquiA3Dias, NOW).canJoin).toBe(false);
  });
});

describe('isUpcomingSession', () => {
  it('aceita agendada no futuro', () => {
    expect(isUpcomingSession(scheduled(2 * 60 * 60 * 1000), NOW)).toBe(true);
  });

  it('aceita agendada que começou há pouco — ainda é a próxima', () => {
    expect(isUpcomingSession(scheduled(-10 * 60 * 1000), NOW)).toBe(true);
  });

  it('recusa agendada cuja janela já passou', () => {
    expect(isUpcomingSession(scheduled(-JOIN_WINDOW_AFTER_MS - 1), NOW)).toBe(false);
  });

  it('recusa imediata', () => {
    expect(isUpcomingSession({ status: 'pending', type: 'immediate' }, NOW)).toBe(false);
  });

  it('recusa concluída e cancelada', () => {
    expect(isUpcomingSession(scheduled(60_000, 'completed'), NOW)).toBe(false);
    expect(isUpcomingSession(scheduled(60_000, 'cancelled'), NOW)).toBe(false);
  });

  it('recusa agendada sem horário', () => {
    expect(isUpcomingSession({ status: 'pending', type: 'scheduled' }, NOW)).toBe(false);
  });
});

describe('describeJoinReason', () => {
  it('descreve cada estado', () => {
    expect(describeJoinReason(canJoinSession(scheduled(0), NOW))).toBe('ENTRAR NA SALA');
    expect(describeJoinReason(canJoinSession(scheduled(9e6), NOW))).toBe('AINDA NÃO ESTÁ NA HORA');
    expect(describeJoinReason(canJoinSession(scheduled(-9e6), NOW))).toBe('HORÁRIO EXPIRADO');
    expect(describeJoinReason(canJoinSession(null, NOW))).toBe('INDISPONÍVEL');
  });
});
