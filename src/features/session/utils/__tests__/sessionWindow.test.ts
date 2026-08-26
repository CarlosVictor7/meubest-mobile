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

// Confirmada por padrão: `pending` agora é SOLICITAÇÃO e nunca entra.
const scheduled = (offsetMs: number, status = 'accepted') => ({
  status,
  type: 'scheduled',
  selectedTime: at(offsetMs),
});

describe('canJoinSession — sessão agendada (confirmada)', () => {
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

describe('canJoinSession — solicitação (pending) nunca entra', () => {
  it('pending dentro da janela → not_confirmed', () => {
    const d = canJoinSession(scheduled(0, 'pending'), NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('not_confirmed');
    expect(d.scheduledAt).toBe(NOW);
  });

  it('pending muito antes → not_confirmed (não too_early)', () => {
    expect(canJoinSession(scheduled(3 * 3600_000, 'pending'), NOW).reason).toBe('not_confirmed');
  });
});

describe('canJoinSession — active', () => {
  it('active LEGADO (sem startedAt) fora da janela NÃO entra — é "confirmada antiga"', () => {
    const d = canJoinSession(scheduled(-5 * 60 * 60 * 1000, 'active'), NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('expired');
  });

  it('active legado dentro da janela entra', () => {
    expect(canJoinSession(scheduled(-10 * 60_000, 'active'), NOW).canJoin).toBe(true);
  });

  it('active legado 3 dias antes NÃO entra (o bug do web antigo)', () => {
    const d = canJoinSession(scheduled(3 * 24 * 3600_000, 'active'), NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('too_early');
  });

  it('active com startedAt entra até o fim da duração (além dos +30 min)', () => {
    const s = { ...scheduled(-45 * 60_000, 'active'), startedAt: at(-40 * 60_000), duration: 60 };
    expect(canJoinSession(s, NOW).canJoin).toBe(true);
  });

  it('active com startedAt e duração curta ainda respeita os +30 min', () => {
    const s = { ...scheduled(-25 * 60_000, 'active'), startedAt: at(-20 * 60_000), duration: 15 };
    expect(canJoinSession(s, NOW).canJoin).toBe(true);
  });

  it('active com startedAt depois da duração → expired', () => {
    const s = { ...scheduled(-61 * 60_000, 'active'), startedAt: at(-60 * 60_000), duration: 60 };
    const d = canJoinSession(s, NOW);
    expect(d.canJoin).toBe(false);
    expect(d.reason).toBe('expired');
  });

  it('active com startedAt não tem limite inferior', () => {
    const s = { ...scheduled(20 * 60_000, 'active'), startedAt: at(-60_000) };
    expect(canJoinSession(s, NOW).canJoin).toBe(true);
  });

  it('active imediata entra sempre', () => {
    expect(canJoinSession({ status: 'active', type: 'immediate' }, NOW).canJoin).toBe(true);
  });
});

describe('canJoinSession — casos de borda', () => {
  it('recusa concluída, cancelada, recusada e expirada', () => {
    for (const status of ['completed', 'cancelled', 'rejected', 'expired']) {
      const d = canJoinSession({ ...scheduled(0), status }, NOW);
      expect(d.canJoin).toBe(false);
      expect(d.reason).toBe('unavailable');
    }
  });

  it('agendada sem selectedTime é tratada como imediata', () => {
    expect(canJoinSession({ status: 'accepted', type: 'scheduled' }, NOW).canJoin).toBe(true);
  });

  it('agendada com selectedTime corrompido é tratada como imediata', () => {
    const d = canJoinSession(
      { status: 'accepted', type: 'scheduled', selectedTime: 'amanhã de manhã' },
      NOW
    );
    expect(d.canJoin).toBe(true);
    expect(d.scheduledAt).toBeNull();
  });

  it('recusa sessão nula', () => {
    expect(canJoinSession(null, NOW).canJoin).toBe(false);
    expect(canJoinSession(undefined, NOW).reason).toBe('unavailable');
  });

  it('o caso que motivou o helper: confirmada para daqui a 3 dias', () => {
    const daquiA3Dias = scheduled(3 * 24 * 60 * 60 * 1000);
    expect(canJoinSession(daquiA3Dias, NOW).canJoin).toBe(false);
  });
});

describe('isUpcomingSession', () => {
  it('aceita agendada confirmada no futuro', () => {
    expect(isUpcomingSession(scheduled(2 * 60 * 60 * 1000), NOW)).toBe(true);
  });

  it('aceita solicitação (pending) no futuro — aparece como "aguardando confirmação"', () => {
    expect(isUpcomingSession(scheduled(2 * 3600_000, 'pending'), NOW)).toBe(true);
  });

  it('aceita active (legado ou em chamada)', () => {
    expect(isUpcomingSession(scheduled(2 * 3600_000, 'active'), NOW)).toBe(true);
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

  it('recusa concluída, cancelada, recusada e expirada', () => {
    for (const status of ['completed', 'cancelled', 'rejected', 'expired']) {
      expect(isUpcomingSession(scheduled(60_000, status), NOW)).toBe(false);
    }
  });

  it('recusa agendada sem horário', () => {
    expect(isUpcomingSession({ status: 'accepted', type: 'scheduled' }, NOW)).toBe(false);
  });
});

describe('describeJoinReason', () => {
  it('descreve cada estado', () => {
    expect(describeJoinReason(canJoinSession(scheduled(0), NOW))).toBe('ENTRAR NA SALA');
    expect(describeJoinReason(canJoinSession(scheduled(9e6), NOW))).toBe('AINDA NÃO ESTÁ NA HORA');
    expect(describeJoinReason(canJoinSession(scheduled(-9e6), NOW))).toBe('HORÁRIO EXPIRADO');
    expect(describeJoinReason(canJoinSession(scheduled(0, 'pending'), NOW))).toBe(
      'AGUARDANDO CONFIRMAÇÃO'
    );
    expect(describeJoinReason(canJoinSession(null, NOW))).toBe('INDISPONÍVEL');
  });
});
