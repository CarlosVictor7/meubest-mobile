/**
 * Todos os casos passam um IANA explícito: o resultado NÃO depende do fuso do
 * runner. O ramo "sem tz" só é verificado por consistência com o Date local.
 */
import { buildSelectedTime, isSlotInPast, getDeviceTimeZone } from '../scheduleTime';

describe('buildSelectedTime', () => {
  it('São Paulo (−03:00, sem horário de verão): 10:00 local → 13:00Z', () => {
    expect(buildSelectedTime('2026-08-26', '10:00', 'America/Sao_Paulo')).toBe(
      '2026-08-26T13:00:00.000Z'
    );
  });

  it('UTC: hora de parede = instante', () => {
    expect(buildSelectedTime('2026-08-26', '21:00', 'UTC')).toBe('2026-08-26T21:00:00.000Z');
  });

  it('Lisboa no verão (+01:00): 09:00 → 08:00Z', () => {
    expect(buildSelectedTime('2026-08-26', '09:00', 'Europe/Lisbon')).toBe(
      '2026-08-26T08:00:00.000Z'
    );
  });

  it('Lisboa no inverno (+00:00): 09:00 → 09:00Z', () => {
    expect(buildSelectedTime('2026-01-15', '09:00', 'Europe/Lisbon')).toBe(
      '2026-01-15T09:00:00.000Z'
    );
  });

  it('Tóquio (+09:00): 02:00 do dia 27 → 17:00Z do dia 26', () => {
    expect(buildSelectedTime('2026-08-27', '02:00', 'Asia/Tokyo')).toBe(
      '2026-08-26T17:00:00.000Z'
    );
  });

  it('aceita hora com um dígito', () => {
    expect(buildSelectedTime('2026-08-26', '9:30', 'UTC')).toBe('2026-08-26T09:30:00.000Z');
  });

  it('entrada inválida → null', () => {
    expect(buildSelectedTime('26/08/2026', '10:00', 'UTC')).toBeNull();
    expect(buildSelectedTime('2026-08-26', '10h', 'UTC')).toBeNull();
    expect(buildSelectedTime('2026-13-01', '10:00', 'UTC')).toBeNull();
    expect(buildSelectedTime('2026-08-26', '24:00', 'UTC')).toBeNull();
    expect(buildSelectedTime('', '', 'UTC')).toBeNull();
  });

  it('sem tz usa o relógio local do runner (mesmo comportamento da tela)', () => {
    const local = new Date(2026, 7, 26, 10, 0, 0, 0);
    expect(buildSelectedTime('2026-08-26', '10:00')).toBe(local.toISOString());
  });
});

describe('isSlotInPast', () => {
  const NOW = Date.parse('2026-08-26T13:00:00.000Z'); // 10:00 em São Paulo

  it('slot antes de agora → passado', () => {
    expect(isSlotInPast('2026-08-26', '09:00', NOW, 'America/Sao_Paulo')).toBe(true);
  });

  it('slot exatamente agora → passado (não dá para solicitar "agora")', () => {
    expect(isSlotInPast('2026-08-26', '10:00', NOW, 'America/Sao_Paulo')).toBe(true);
  });

  it('slot depois → futuro', () => {
    expect(isSlotInPast('2026-08-26', '10:01', NOW, 'America/Sao_Paulo')).toBe(false);
    expect(isSlotInPast('2026-08-27', '09:00', NOW, 'America/Sao_Paulo')).toBe(false);
  });

  it('entrada inválida conta como passado (bloqueia)', () => {
    expect(isSlotInPast('x', '10:00', NOW, 'UTC')).toBe(true);
  });
});

describe('getDeviceTimeZone', () => {
  it('devolve string IANA ou null, nunca lança', () => {
    const tz = getDeviceTimeZone();
    expect(tz === null || typeof tz === 'string').toBe(true);
  });
});
