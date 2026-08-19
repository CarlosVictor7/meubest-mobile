/**
 * availability — testes das regras puras da disponibilidade programada.
 *
 * O caso que motivou tudo: no Brasil (UTC−3), gerar a chave com toISOString()
 * faz o dia virar às 21:00 locais. `localDateKey` não pode ter esse defeito.
 */
import {
  localDateKey,
  parseTimeToMinutes,
  isWallClockInSlot,
  isScheduledAvailableNow,
  pruneAvailability,
  isListenerLiveNow,
  isListenerPushEligibleNow,
  countUpcomingSlots,
  AVAILABILITY_SLOT_MINUTES,
  AVAILABILITY_TIMES,
  type AvailabilityMap,
} from '../availability';
import { PRESENCE_STALE_AFTER_MS } from '../presence';

/** Date em hora LOCAL — nunca UTC — para os testes espelharem o aparelho. */
const local = (y: number, m: number, d: number, hh = 0, mm = 0) =>
  new Date(y, m - 1, d, hh, mm, 0, 0);

describe('localDateKey', () => {
  it('gera YYYY-MM-DD com zero à esquerda', () => {
    expect(localDateKey(local(2026, 8, 5, 10, 0))).toBe('2026-08-05');
    expect(localDateKey(local(2026, 12, 31))).toBe('2026-12-31');
  });

  it('meia-noite local pertence ao próprio dia', () => {
    expect(localDateKey(local(2026, 8, 20, 0, 0))).toBe('2026-08-20');
  });

  it('REGRESSÃO D1: 22:00 e 23:59 locais NÃO viram o dia seguinte', () => {
    // No bug da web, 22:00 em UTC−3 gera chave de 21/08 via toISOString().
    expect(localDateKey(local(2026, 8, 20, 22, 0))).toBe('2026-08-20');
    expect(localDateKey(local(2026, 8, 20, 23, 59))).toBe('2026-08-20');
  });

  it('01:00 local não vira o dia anterior', () => {
    // O defeito espelhado (fusos a leste de UTC) também não pode existir.
    expect(localDateKey(local(2026, 8, 20, 1, 0))).toBe('2026-08-20');
  });

  it('difere de toISOString exatamente no cenário do bug', () => {
    const d = local(2026, 8, 20, 23, 0);
    const utcKey = d.toISOString().split('T')[0];
    // Só faz sentido comparar quando o fuso local não é UTC; em UTC as duas
    // formas coincidem e o teste não teria o que provar.
    if (d.getTimezoneOffset() > 0) {
      expect(utcKey).not.toBe('2026-08-20'); // a forma errada erra…
    }
    expect(localDateKey(d)).toBe('2026-08-20'); // …e a nossa acerta sempre.
  });
});

describe('parseTimeToMinutes', () => {
  it('converte os 12 horários oficiais', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540);
    expect(parseTimeToMinutes('22:00')).toBe(1320);
    for (const t of AVAILABILITY_TIMES) {
      expect(parseTimeToMinutes(t)).not.toBeNull();
    }
  });

  it('rejeita malformados sem lançar', () => {
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('9:00')).toBeNull();
    expect(parseTimeToMinutes('19h')).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes(undefined as any)).toBeNull();
  });
});

describe('isScheduledAvailableNow', () => {
  const agenda: AvailabilityMap = { '2026-08-20': ['19:00'] };

  it('sem agenda → false', () => {
    expect(isScheduledAvailableNow(undefined, local(2026, 8, 20, 19, 30))).toBe(false);
    expect(isScheduledAvailableNow(null, local(2026, 8, 20, 19, 30))).toBe(false);
    expect(isScheduledAvailableNow({}, local(2026, 8, 20, 19, 30))).toBe(false);
  });

  it('antes do slot → false', () => {
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 20, 18, 59))).toBe(false);
  });

  it('início exato, meio e último minuto → true', () => {
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 20, 19, 0))).toBe(true);
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 20, 19, 30))).toBe(true);
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 20, 19, 59))).toBe(true);
  });

  it('fim do slot (exclusivo) e depois → false', () => {
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 20, 20, 0))).toBe(false);
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 20, 21, 0))).toBe(false);
  });

  it('slot de amanhã não vale hoje (e vice-versa)', () => {
    const amanha: AvailabilityMap = { '2026-08-21': ['19:00'] };
    expect(isScheduledAvailableNow(amanha, local(2026, 8, 20, 19, 30))).toBe(false);
    expect(isScheduledAvailableNow(agenda, local(2026, 8, 21, 19, 30))).toBe(false);
  });

  it('slot às 22:00 termina às 23:00 e NÃO vaza para o dia seguinte', () => {
    const noite: AvailabilityMap = { '2026-08-20': ['22:00'] };
    expect(isScheduledAvailableNow(noite, local(2026, 8, 20, 22, 59))).toBe(true);
    expect(isScheduledAvailableNow(noite, local(2026, 8, 20, 23, 0))).toBe(false);
    expect(isScheduledAvailableNow(noite, local(2026, 8, 21, 0, 30))).toBe(false);
  });

  it('múltiplos slots no dia: qualquer um ativo basta', () => {
    const multi: AvailabilityMap = { '2026-08-20': ['09:00', '15:00', '21:00'] };
    expect(isScheduledAvailableNow(multi, local(2026, 8, 20, 15, 45))).toBe(true);
    expect(isScheduledAvailableNow(multi, local(2026, 8, 20, 12, 0))).toBe(false);
  });

  it('múltiplos dias: usa só o dia corrente', () => {
    const semana: AvailabilityMap = {
      '2026-08-20': ['09:00'],
      '2026-08-22': ['19:00'],
    };
    expect(isScheduledAvailableNow(semana, local(2026, 8, 22, 19, 10))).toBe(true);
    expect(isScheduledAvailableNow(semana, local(2026, 8, 21, 9, 30))).toBe(false);
  });

  it('slot malformado dentro da lista é ignorado sem lançar', () => {
    const suja: AvailabilityMap = { '2026-08-20': ['xx:yy', '19:00'] };
    expect(isScheduledAvailableNow(suja, local(2026, 8, 20, 19, 10))).toBe(true);
    expect(isScheduledAvailableNow(suja, local(2026, 8, 20, 8, 0))).toBe(false);
  });

  it('respeita slotMinutes customizado', () => {
    expect(
      isWallClockInSlot(agenda, '2026-08-20', 19 * 60 + 45, 30)
    ).toBe(false); // slot de 30 min já acabou às 19:30
  });

  it('duração default é 60 minutos — a semântica real da web', () => {
    expect(AVAILABILITY_SLOT_MINUTES).toBe(60);
  });
});

describe('pruneAvailability', () => {
  const HOJE = '2026-08-20';

  it('remove datas passadas — inclusive as de maio vistas em produção', () => {
    const mapa: AvailabilityMap = {
      '2026-05-28': ['09:00'],
      '2026-05-29': ['10:00'],
      '2026-08-19': ['19:00'],
      '2026-08-20': ['20:00'],
      '2026-08-25': ['21:00'],
    };
    expect(pruneAvailability(mapa, HOJE)).toEqual({
      '2026-08-20': ['20:00'],
      '2026-08-25': ['21:00'],
    });
  });

  it('mantém hoje e o futuro intactos', () => {
    const mapa: AvailabilityMap = { '2026-08-20': ['09:00'], '2027-01-01': ['10:00'] };
    expect(pruneAvailability(mapa, HOJE)).toEqual(mapa);
  });

  it('remove entradas de array vazio', () => {
    expect(pruneAvailability({ '2026-08-25': [] }, HOJE)).toEqual({});
  });

  it('preserva chaves que não parecem data (não destrói o que não reconhece)', () => {
    const mapa = { estranho: ['09:00'], '2026-05-01': ['09:00'] } as AvailabilityMap;
    expect(pruneAvailability(mapa, HOJE)).toEqual({ estranho: ['09:00'] });
  });

  it('mapa vazio/nulo → objeto vazio', () => {
    expect(pruneAvailability({}, HOJE)).toEqual({});
    expect(pruneAvailability(null, HOJE)).toEqual({});
    expect(pruneAvailability(undefined, HOJE)).toEqual({});
  });

  it('é idempotente', () => {
    const mapa: AvailabilityMap = { '2026-05-01': ['09:00'], '2026-08-25': ['10:00'] };
    const uma = pruneAvailability(mapa, HOJE);
    expect(pruneAvailability(uma, HOJE)).toEqual(uma);
  });
});

describe('isListenerLiveNow — presença ao vivo (popup em tempo real)', () => {
  const NOW = Date.parse('2026-08-20T19:30:00.000Z');
  const fresh = new Date(NOW - 60_000).toISOString();
  const stale = new Date(NOW - PRESENCE_STALE_AFTER_MS - 1).toISOString();

  it('exige modo acolhedor + chave ligada + presença fresca', () => {
    expect(isListenerLiveNow({ role: 'listener', listenerStatus: 'approved', isOnline: true, lastSeenAt: fresh }, NOW)).toBe(true);
  });

  it('presença obsoleta derruba o AO VIVO (mas não a push — ver abaixo)', () => {
    expect(isListenerLiveNow({ role: 'listener', listenerStatus: 'approved', isOnline: true, lastSeenAt: stale }, NOW)).toBe(false);
  });

  it('speaker nunca está live como acolhedor', () => {
    expect(isListenerLiveNow({ role: 'speaker', isOnline: true, lastSeenAt: fresh }, NOW)).toBe(false);
  });

  it('chave desligada → false', () => {
    expect(isListenerLiveNow({ role: 'listener', listenerStatus: 'approved', isOnline: false, lastSeenAt: fresh }, NOW)).toBe(false);
  });
});

describe('isListenerPushEligibleNow — a regra final do GO (§7)', () => {
  const agendaAtiva: AvailabilityMap = { '2026-08-20': ['19:00'] };
  const dentroDoSlot = local(2026, 8, 20, 19, 30);
  const foraDoSlot = local(2026, 8, 20, 12, 0);
  const staleSeen = new Date(
    dentroDoSlot.getTime() - PRESENCE_STALE_AFTER_MS - 60_000
  ).toISOString();

  it('CENÁRIO CENTRAL: chave ligada + app fechado há horas → ELEGÍVEL', () => {
    // lastSeenAt velho NÃO cancela o opt-in manual. Fechar o app não é logout.
    expect(
      isListenerPushEligibleNow(
        { role: 'listener', listenerStatus: 'approved', isOnline: true, lastSeenAt: staleSeen },
        foraDoSlot
      )
    ).toBe(true);
  });

  it('chave desligada, mas dentro da agenda → ELEGÍVEL', () => {
    expect(
      isListenerPushEligibleNow(
        { role: 'listener', listenerStatus: 'approved', isOnline: false, availability: agendaAtiva },
        dentroDoSlot
      )
    ).toBe(true);
  });

  it('chave desligada e fora da agenda → NÃO elegível', () => {
    expect(
      isListenerPushEligibleNow(
        { role: 'listener', listenerStatus: 'approved', isOnline: false, availability: agendaAtiva },
        foraDoSlot
      )
    ).toBe(false);
  });

  it('logout (isOnline false, sem agenda) → NÃO elegível', () => {
    expect(
      isListenerPushEligibleNow({ role: 'listener', listenerStatus: 'approved', isOnline: false }, dentroDoSlot)
    ).toBe(false);
  });

  it('speaker nunca é elegível, mesmo com agenda e chave', () => {
    expect(
      isListenerPushEligibleNow(
        { role: 'speaker', isOnline: true, availability: agendaAtiva },
        dentroDoSlot
      )
    ).toBe(false);
  });

  it('é OR, nunca AND: qualquer um dos dois caminhos basta', () => {
    const soChave = { role: 'listener', listenerStatus: 'approved', isOnline: true } as const;
    const soAgenda = {
      role: 'listener',
      listenerStatus: 'approved',
      isOnline: false,
      availability: agendaAtiva,
    } as const;
    expect(isListenerPushEligibleNow(soChave, foraDoSlot)).toBe(true);
    expect(isListenerPushEligibleNow(soAgenda, dentroDoSlot)).toBe(true);
  });

  it('perfil nulo → false, sem lançar', () => {
    expect(isListenerPushEligibleNow(null, dentroDoSlot)).toBe(false);
    expect(isListenerPushEligibleNow(undefined, dentroDoSlot)).toBe(false);
  });
});

describe('countUpcomingSlots — o contador do card da Home', () => {
  const now = local(2026, 8, 20, 15, 30);

  it('conta slots de hoje ainda não terminados + dias futuros', () => {
    const mapa: AvailabilityMap = {
      '2026-08-20': ['09:00', '15:00', '19:00'], // 09 já acabou; 15 está ativo; 19 vem aí
      '2026-08-21': ['10:00'],
      '2026-05-01': ['09:00'], // passado: ignorado
    };
    expect(countUpcomingSlots(mapa, now)).toBe(3);
  });

  it('sem agenda → 0', () => {
    expect(countUpcomingSlots(undefined, now)).toBe(0);
    expect(countUpcomingSlots({}, now)).toBe(0);
  });
});
