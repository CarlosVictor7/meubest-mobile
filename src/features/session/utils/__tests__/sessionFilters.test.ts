import {
  mergeSessions,
  filterHistory,
  filterUpcoming,
  getCounterpart,
  toMillis,
} from '../sessionFilters';
import { isUpcomingSession } from '../sessionWindow';

const NOW = Date.parse('2026-08-18T15:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('toMillis', () => {
  it('aceita Firestore Timestamp com toMillis', () => {
    expect(toMillis({ toMillis: () => 1234 })).toBe(1234);
  });

  it('aceita Firestore Timestamp com toDate', () => {
    expect(toMillis({ toDate: () => new Date(5000) })).toBe(5000);
  });

  it('aceita Timestamp cru com seconds', () => {
    expect(toMillis({ seconds: 10 })).toBe(10_000);
  });

  it('aceita Date, número e string ISO', () => {
    expect(toMillis(new Date(7000))).toBe(7000);
    expect(toMillis(9000)).toBe(9000);
    expect(toMillis('2026-08-18T15:00:00.000Z')).toBe(NOW);
  });

  it('devolve 0 para valores ausentes ou inválidos', () => {
    expect(toMillis(null)).toBe(0);
    expect(toMillis(undefined)).toBe(0);
    expect(toMillis('nao e data')).toBe(0);
    expect(toMillis({})).toBe(0);
  });
});

describe('mergeSessions', () => {
  const comoSpeaker = [
    { id: 'a', createdAt: 300 },
    { id: 'b', createdAt: 100 },
  ];
  const comoListener = [
    { id: 'c', createdAt: 200 },
    { id: 'd', createdAt: 400 },
  ];

  it('une os dois papéis', () => {
    expect(mergeSessions(comoSpeaker, comoListener).map((s) => s.id)).toEqual([
      'd',
      'a',
      'c',
      'b',
    ]);
  });

  it('ordena por createdAt decrescente', () => {
    const r = mergeSessions(comoSpeaker, comoListener);
    for (let i = 1; i < r.length; i++) {
      expect(toMillis(r[i - 1].createdAt)).toBeGreaterThanOrEqual(toMillis(r[i].createdAt));
    }
  });

  it('deduplica por id', () => {
    const r = mergeSessions([{ id: 'x', createdAt: 1 }], [{ id: 'x', createdAt: 1 }]);
    expect(r).toHaveLength(1);
  });

  it('tolera grupos vazios, nulos e indefinidos', () => {
    expect(mergeSessions([], null, undefined)).toEqual([]);
    expect(mergeSessions(comoSpeaker, null).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('ignora itens sem id', () => {
    expect(mergeSessions([{ id: '', createdAt: 1 } as any, { id: 'ok', createdAt: 2 }])).toHaveLength(1);
  });

  it('o caso que motivou o helper: alternar de papel não some com o histórico', () => {
    // Antes, a consulta usava speakerId OU listenerId conforme o papel atual.
    const tudo = mergeSessions(comoSpeaker, comoListener);
    expect(tudo).toHaveLength(4);
  });
});

describe('filterHistory', () => {
  const todas = [
    { id: '1', status: 'completed' },
    { id: '2', status: 'cancelled' },
    { id: '3', status: 'rejected' },
    { id: '4', status: 'pending' },
    { id: '5', status: 'active' },
    { id: '6', status: 'completed' },
  ];

  it('deixa passar somente completed', () => {
    expect(filterHistory(todas).map((s) => s.id)).toEqual(['1', '6']);
  });

  it('elimina o caminho do CANCELADA CANCELADA', () => {
    expect(filterHistory(todas).some((s) => s.status === 'cancelled')).toBe(false);
    expect(filterHistory(todas).some((s) => s.status === 'rejected')).toBe(false);
  });

  it('tolera lista vazia e nula', () => {
    expect(filterHistory([])).toEqual([]);
    expect(filterHistory(null)).toEqual([]);
  });
});

describe('filterUpcoming', () => {
  const sessoes = [
    { id: 'depois', status: 'pending', type: 'scheduled', selectedTime: at(4 * 3600_000) },
    { id: 'antes', status: 'pending', type: 'scheduled', selectedTime: at(1 * 3600_000) },
    { id: 'passada', status: 'pending', type: 'scheduled', selectedTime: at(-5 * 3600_000) },
    { id: 'imediata', status: 'pending', type: 'immediate' },
    { id: 'concluida', status: 'completed', type: 'scheduled', selectedTime: at(3600_000) },
  ];

  it('ordena crescente — a mais próxima primeiro', () => {
    const r = filterUpcoming(sessoes, (s) => isUpcomingSession(s, NOW));
    expect(r.map((s) => s.id)).toEqual(['antes', 'depois']);
  });

  it('exclui passadas, imediatas e concluídas', () => {
    const ids = filterUpcoming(sessoes, (s) => isUpcomingSession(s, NOW)).map((s) => s.id);
    expect(ids).not.toContain('passada');
    expect(ids).not.toContain('imediata');
    expect(ids).not.toContain('concluida');
  });

  it('tolera lista nula', () => {
    expect(filterUpcoming(null, () => true)).toEqual([]);
  });
});

describe('getCounterpart', () => {
  const sessao = {
    id: 's1',
    speakerId: 'u-speaker',
    listenerId: 'u-listener',
    speakerName: 'Ana',
    listenerName: 'Bia',
  };

  it('para o speaker, a contraparte é o listener', () => {
    expect(getCounterpart(sessao, 'u-speaker')).toEqual({
      id: 'u-listener',
      name: 'Bia',
      role: 'listener',
    });
  });

  it('para o listener, a contraparte é o speaker', () => {
    expect(getCounterpart(sessao, 'u-listener')).toEqual({
      id: 'u-speaker',
      name: 'Ana',
      role: 'speaker',
    });
  });

  it('devolve null quando a sessão ainda não tem apoiador', () => {
    expect(getCounterpart({ ...sessao, listenerId: null }, 'u-speaker')).toBeNull();
  });

  it('devolve null para quem não participou', () => {
    expect(getCounterpart(sessao, 'u-outro')).toBeNull();
  });

  it('usa rótulo genérico quando o nome não foi gravado', () => {
    const semNome = { ...sessao, listenerName: undefined };
    expect(getCounterpart(semNome, 'u-speaker')?.name).toBe('Acolhedor');
  });

  it('tolera sessão e uid ausentes', () => {
    expect(getCounterpart(null, 'u')).toBeNull();
    expect(getCounterpart(sessao, null)).toBeNull();
  });
});
