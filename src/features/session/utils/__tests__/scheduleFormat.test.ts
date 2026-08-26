import { formatScheduleWhen, formatDuration } from '../scheduleFormat';

describe('formatScheduleWhen', () => {
  const ISO = '2026-08-26T13:00:00.000Z';

  it('formata no fuso informado (São Paulo = 10:00)', () => {
    const w = formatScheduleWhen(ISO, 'America/Sao_Paulo')!;
    expect(w.day).toBe('26/08/2026');
    expect(w.time).toBe('10:00');
    expect(w.full).toBe('26/08/2026 10:00');
    expect(w.long).toMatch(/quarta-feira/);
    expect(w.long).toMatch(/26 de agosto/);
  });

  it('mesmo instante em outro fuso muda a hora de parede (Lisboa = 14:00)', () => {
    expect(formatScheduleWhen(ISO, 'Europe/Lisbon')!.time).toBe('14:00');
  });

  it('vira o dia quando o fuso pede (Tóquio = 27/08 22:00)', () => {
    const w = formatScheduleWhen(ISO, 'Asia/Tokyo')!;
    expect(w.day).toBe('26/08/2026');
    expect(w.time).toBe('22:00');
  });

  it('ausente/corrompido → null', () => {
    expect(formatScheduleWhen(null)).toBeNull();
    expect(formatScheduleWhen('')).toBeNull();
    expect(formatScheduleWhen('amanhã')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('minutos, horas e mistos', () => {
    expect(formatDuration(15)).toBe('15 min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(0)).toBe('30 min');
    expect(formatDuration(undefined)).toBe('30 min');
  });
});
