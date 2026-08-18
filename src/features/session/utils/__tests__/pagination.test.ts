/**
 * Testes da paginação do histórico.
 *
 * O foco é a regra 5 → 10 → 15 → ... e as duas propriedades que a tornam
 * segura: a lista visível é sempre um PREFIXO da completa (nunca perde item já
 * exibido) e o contador nunca ultrapassa o total (senão `remaining` mentiria).
 */
import {
  HISTORY_PAGE_SIZE,
  UPCOMING_PAGE_SIZE,
  advance,
  hasMore,
  paginate,
  remaining,
} from '../pagination';
import { filterHistory, filterUpcoming, mergeSessions } from '../sessionFilters';
import { isUpcomingSession } from '../sessionWindow';

const item = (n: number) => ({ id: `s${n}` });
const listOf = (n: number) => Array.from({ length: n }, (_, i) => item(i));

describe('constantes', () => {
  it('o histórico pagina de 5 em 5', () => {
    expect(HISTORY_PAGE_SIZE).toBe(5);
  });

  it('as próximas sessões mostram 3 antes de expandir', () => {
    expect(UPCOMING_PAGE_SIZE).toBe(3);
  });
});

describe('paginate', () => {
  it('devolve o prefixo pedido', () => {
    expect(paginate(listOf(13), 5).map((i) => i.id)).toEqual(['s0', 's1', 's2', 's3', 's4']);
  });

  it('nunca devolve mais do que existe', () => {
    expect(paginate(listOf(3), 5)).toHaveLength(3);
  });

  it('tolera lista vazia, nula e indefinida', () => {
    expect(paginate([], 5)).toEqual([]);
    expect(paginate(null, 5)).toEqual([]);
    expect(paginate(undefined, 5)).toEqual([]);
  });

  it('trata contador inválido como zero', () => {
    expect(paginate(listOf(10), 0)).toEqual([]);
    expect(paginate(listOf(10), -3)).toEqual([]);
    expect(paginate(listOf(10), NaN)).toEqual([]);
  });
});

describe('hasMore / remaining', () => {
  it.each([
    [0, 5, false, 0],
    [1, 5, false, 0],
    [5, 5, false, 0],
    [6, 5, true, 1],
    [10, 5, true, 5],
    [13, 5, true, 8],
    [21, 5, true, 16],
  ])('total=%i visíveis=%i → hasMore=%s, faltam=%i', (total, visible, more, falta) => {
    const list = listOf(total);
    expect(hasMore(list, visible)).toBe(more);
    expect(remaining(list, visible)).toBe(falta);
  });

  it('não fica negativo quando o contador passa do total', () => {
    expect(remaining(listOf(3), 99)).toBe(0);
    expect(hasMore(listOf(3), 99)).toBe(false);
  });

  it('tolera lista nula', () => {
    expect(hasMore(null, 5)).toBe(false);
    expect(remaining(undefined, 5)).toBe(0);
  });
});

describe('advance', () => {
  it('a sequência é 5 → 10 → 15 e para no total', () => {
    const total = 13;
    let visible = HISTORY_PAGE_SIZE;
    const passos = [visible];
    while (hasMore(listOf(total), visible)) {
      visible = advance(visible, total);
      passos.push(visible);
    }
    expect(passos).toEqual([5, 10, 13]);
  });

  it('nunca ultrapassa o total', () => {
    expect(advance(5, 6)).toBe(6);
    expect(advance(50, 3)).toBe(3);
  });

  it('aceita tamanho de página próprio', () => {
    expect(advance(3, 10, UPCOMING_PAGE_SIZE)).toBe(6);
  });

  it('total zero não gera contador negativo', () => {
    expect(advance(5, 0)).toBe(0);
  });
});

describe('propriedade: carregar mais nunca perde item já exibido', () => {
  it('cada página é prefixo da seguinte', () => {
    const list = listOf(23);
    let visible = HISTORY_PAGE_SIZE;
    let anterior = paginate(list, visible);

    while (hasMore(list, visible)) {
      visible = advance(visible, list.length);
      const atual = paginate(list, visible);
      expect(atual.slice(0, anterior.length)).toEqual(anterior);
      expect(atual.length).toBeGreaterThan(anterior.length);
      anterior = atual;
    }

    expect(anterior).toHaveLength(23);
  });
});

describe('integração com o filtro de histórico', () => {
  it('pagina somente as concluídas, ignorando cancelled/rejected/pending/active', () => {
    const sessions = [
      { id: 'a', status: 'completed', createdAt: 5 },
      { id: 'b', status: 'cancelled', createdAt: 4 },
      { id: 'c', status: 'completed', createdAt: 3 },
      { id: 'd', status: 'rejected', createdAt: 2 },
      { id: 'e', status: 'pending', createdAt: 1 },
      { id: 'f', status: 'active', createdAt: 0 },
    ];

    const history = filterHistory(mergeSessions(sessions));
    expect(history.map((s) => s.id)).toEqual(['a', 'c']);
    expect(paginate(history, HISTORY_PAGE_SIZE).map((s) => s.id)).toEqual(['a', 'c']);
    expect(hasMore(history, HISTORY_PAGE_SIZE)).toBe(false);
  });

  it('dedupe entre os dois papéis não infla a contagem', () => {
    const comoSpeaker = [{ id: 'x', status: 'completed', createdAt: 2 }];
    const comoListener = [
      { id: 'x', status: 'completed', createdAt: 2 },
      { id: 'y', status: 'completed', createdAt: 1 },
    ];

    const history = filterHistory(mergeSessions(comoSpeaker, comoListener));
    expect(history).toHaveLength(2);
    expect(remaining(history, HISTORY_PAGE_SIZE)).toBe(0);
  });

  it('o caso real medido em produção: 114 sessões, 54 concluídas', () => {
    // 54 completed + 58 cancelled + 2 rejected — a proporção que fazia o
    // limite de 30 da consulta antiga devolver só 13 concluídas.
    const sessions = [
      ...Array.from({ length: 54 }, (_, i) => ({
        id: `c${i}`,
        status: 'completed',
        createdAt: 1000 - i,
      })),
      ...Array.from({ length: 58 }, (_, i) => ({
        id: `x${i}`,
        status: 'cancelled',
        createdAt: 2000 - i,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `r${i}`,
        status: 'rejected',
        createdAt: 3000 - i,
      })),
    ];

    const history = filterHistory(mergeSessions(sessions));
    expect(history).toHaveLength(54);

    // 5 na primeira tela, e o botão promete exatamente as 49 restantes.
    expect(paginate(history, HISTORY_PAGE_SIZE)).toHaveLength(5);
    expect(remaining(history, HISTORY_PAGE_SIZE)).toBe(49);

    // Dez toques em VER MAIS revelam as 54 sem sobra nem repetição:
    // 5 → 10 → 15 → 20 → 25 → 30 → 35 → 40 → 45 → 50 → 54.
    let visible = HISTORY_PAGE_SIZE;
    let toques = 0;
    while (hasMore(history, visible)) {
      visible = advance(visible, history.length);
      toques += 1;
    }
    expect(toques).toBe(10);
    expect(paginate(history, visible)).toHaveLength(54);
    expect(new Set(paginate(history, visible).map((s) => s.id)).size).toBe(54);
  });

  it('mantém a ordem do mais recente para o mais antigo', () => {
    const history = filterHistory(
      mergeSessions([
        { id: 'velha', status: 'completed', createdAt: 100 },
        { id: 'nova', status: 'completed', createdAt: 300 },
        { id: 'meio', status: 'completed', createdAt: 200 },
      ])
    );
    expect(paginate(history, HISTORY_PAGE_SIZE).map((s) => s.id)).toEqual([
      'nova',
      'meio',
      'velha',
    ]);
  });
});

describe('próximas sessões — paginação de 3 em 3', () => {
  const emMinutos = (m: number) => new Date(Date.now() + m * 60 * 1000).toISOString();

  const agendada = (id: string, minutos: number) => ({
    id,
    status: 'pending',
    type: 'scheduled',
    selectedTime: emMinutos(minutos),
    createdAt: 1,
  });

  it('mostra 3 e promete o resto, da mais próxima para a mais distante', () => {
    const sessions = [
      agendada('d', 400),
      agendada('a', 60),
      agendada('c', 300),
      agendada('b', 120),
      agendada('e', 500),
    ];

    const upcoming = filterUpcoming(sessions, (s) => isUpcomingSession(s));
    expect(upcoming.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);

    expect(paginate(upcoming, UPCOMING_PAGE_SIZE).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(remaining(upcoming, UPCOMING_PAGE_SIZE)).toBe(2);

    const visible = advance(UPCOMING_PAGE_SIZE, upcoming.length, UPCOMING_PAGE_SIZE);
    expect(visible).toBe(5);
    expect(hasMore(upcoming, visible)).toBe(false);
  });

  it('sessão concluída ou cancelada nunca entra em próximas', () => {
    const sessions = [
      { ...agendada('ok', 90) },
      { ...agendada('feita', 90), status: 'completed' },
      { ...agendada('fora', 90), status: 'cancelled' },
      { ...agendada('imediata', 90), type: 'immediate' },
    ];

    const upcoming = filterUpcoming(sessions, (s) => isUpcomingSession(s));
    expect(upcoming.map((s) => s.id)).toEqual(['ok']);
  });

  it('lista vazia devolve vazio — a tela mostra o empty state', () => {
    const upcoming = filterUpcoming([], (s) => isUpcomingSession(s));
    expect(upcoming).toEqual([]);
    expect(paginate(upcoming, UPCOMING_PAGE_SIZE)).toEqual([]);
    expect(hasMore(upcoming, UPCOMING_PAGE_SIZE)).toBe(false);
  });
});
