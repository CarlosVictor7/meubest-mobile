import { isPendingScheduleRequest, pendingScheduleRequests } from '../scheduleRequest';
import { JOIN_WINDOW_AFTER_MS } from '../sessionWindow';

const NOW = Date.parse('2026-08-26T15:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const ME = 'uid-me';

const req = (over: Record<string, any> = {}) => ({
  id: over.id ?? 'r1',
  type: 'scheduled',
  status: 'pending',
  listenerId: ME,
  speakerId: 'uid-other',
  selectedTime: at(2 * 3600_000),
  ...over,
});

describe('isPendingScheduleRequest', () => {
  it('agendada + pending + listenerId == uid → solicitação', () => {
    expect(isPendingScheduleRequest(req(), ME, NOW)).toBe(true);
  });

  it('NUNCA para imediata (fica com o useIncomingCall)', () => {
    expect(isPendingScheduleRequest(req({ type: 'immediate' }), ME, NOW)).toBe(false);
  });

  it('não para aceita, recusada, cancelada, expirada', () => {
    for (const status of ['accepted', 'active', 'rejected', 'cancelled', 'expired', 'completed']) {
      expect(isPendingScheduleRequest(req({ status }), ME, NOW)).toBe(false);
    }
  });

  it('não quando o listener é outro ou é aleatória (null)', () => {
    expect(isPendingScheduleRequest(req({ listenerId: 'uid-x' }), ME, NOW)).toBe(false);
    expect(isPendingScheduleRequest(req({ listenerId: null }), ME, NOW)).toBe(false);
  });

  it('não quando o horário já ficou para trás além da tolerância', () => {
    expect(
      isPendingScheduleRequest(req({ selectedTime: at(-JOIN_WINDOW_AFTER_MS - 1) }), ME, NOW)
    ).toBe(false);
    // Dentro da tolerância ainda vale — o worker só expira em ~30 min.
    expect(isPendingScheduleRequest(req({ selectedTime: at(-10 * 60_000) }), ME, NOW)).toBe(true);
  });

  it('sem selectedTime ou corrompido ainda conta (não esconde a solicitação)', () => {
    expect(isPendingScheduleRequest(req({ selectedTime: null }), ME, NOW)).toBe(true);
    expect(isPendingScheduleRequest(req({ selectedTime: 'x' }), ME, NOW)).toBe(true);
  });

  it('nulos → false, nunca lança', () => {
    expect(isPendingScheduleRequest(null, ME, NOW)).toBe(false);
    expect(isPendingScheduleRequest(req(), null, NOW)).toBe(false);
  });
});

describe('pendingScheduleRequests', () => {
  it('filtra, ordena pela data mais próxima e respeita dismissed', () => {
    const list = [
      req({ id: 'late', selectedTime: at(5 * 3600_000) }),
      req({ id: 'immediate', type: 'immediate' }),
      req({ id: 'soon', selectedTime: at(1 * 3600_000) }),
      req({ id: 'dismissed', selectedTime: at(30 * 60_000) }),
      req({ id: 'notMine', listenerId: 'z' }),
      req({ id: 'accepted', status: 'accepted' }),
    ];
    const out = pendingScheduleRequests(list, ME, new Set(['dismissed']), NOW);
    expect(out.map((s) => s.id)).toEqual(['soon', 'late']);
  });

  it('aceita array de dismissed', () => {
    const out = pendingScheduleRequests([req({ id: 'a' }), req({ id: 'b' })], ME, ['a'], NOW);
    expect(out.map((s) => s.id)).toEqual(['b']);
  });

  it('sem horário vai para o fim', () => {
    const out = pendingScheduleRequests(
      [req({ id: 'none', selectedTime: null }), req({ id: 'dated' })],
      ME,
      [],
      NOW
    );
    expect(out.map((s) => s.id)).toEqual(['dated', 'none']);
  });

  it('lista vazia / uid nulo → []', () => {
    expect(pendingScheduleRequests(null, ME)).toEqual([]);
    expect(pendingScheduleRequests([req()], null)).toEqual([]);
  });
});
