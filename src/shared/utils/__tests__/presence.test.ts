import {
  isPresenceFresh,
  isAvailableNow,
  PRESENCE_STALE_AFTER_MS,
} from '../presence';

const NOW = Date.parse('2026-08-18T12:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('isPresenceFresh', () => {
  it('aceita marca recente', () => {
    expect(isPresenceFresh(iso(60_000), NOW)).toBe(true);
  });

  it('aceita marca exatamente no limite', () => {
    expect(isPresenceFresh(iso(PRESENCE_STALE_AFTER_MS), NOW)).toBe(true);
  });

  it('rejeita marca um milissegundo além do limite', () => {
    expect(isPresenceFresh(iso(PRESENCE_STALE_AFTER_MS + 1), NOW)).toBe(false);
  });

  it('rejeita marca bem antiga', () => {
    expect(isPresenceFresh(iso(2 * 60 * 60 * 1000), NOW)).toBe(false);
  });

  it('trata ausência do campo como fresca — usuário anterior à funcionalidade', () => {
    expect(isPresenceFresh(undefined, NOW)).toBe(true);
    expect(isPresenceFresh(null, NOW)).toBe(true);
    expect(isPresenceFresh('', NOW)).toBe(true);
  });

  it('trata valor corrompido como fresco — não penaliza o usuário', () => {
    expect(isPresenceFresh('nao-e-uma-data', NOW)).toBe(true);
  });

  it('tolera relógio adiantado no cliente', () => {
    expect(isPresenceFresh(iso(-5 * 60 * 1000), NOW)).toBe(true);
  });

  it('aceita janela customizada', () => {
    expect(isPresenceFresh(iso(90_000), NOW, 60_000)).toBe(false);
    expect(isPresenceFresh(iso(30_000), NOW, 60_000)).toBe(true);
  });
});

describe('isAvailableNow', () => {
  it('exige isOnline', () => {
    expect(isAvailableNow({ isOnline: false, lastSeenAt: iso(1000) }, NOW)).toBe(false);
    expect(isAvailableNow({ lastSeenAt: iso(1000) }, NOW)).toBe(false);
  });

  it('exige presença recente', () => {
    expect(
      isAvailableNow({ isOnline: true, lastSeenAt: iso(PRESENCE_STALE_AFTER_MS + 1) }, NOW)
    ).toBe(false);
  });

  it('aprova quando as duas condições valem', () => {
    expect(isAvailableNow({ isOnline: true, lastSeenAt: iso(60_000) }, NOW)).toBe(true);
  });

  it('aprova usuário online sem lastSeenAt — anterior à funcionalidade', () => {
    expect(isAvailableNow({ isOnline: true }, NOW)).toBe(true);
  });

  it('rejeita perfil nulo', () => {
    expect(isAvailableNow(null, NOW)).toBe(false);
    expect(isAvailableNow(undefined, NOW)).toBe(false);
  });

  it('o caso que motivou o campo: app morto pelo sistema com a chave ligada', () => {
    // O usuário virou a chave, o sistema matou o app, ninguém desligou nada.
    // isOnline continua true no Firestore — mas ele não está lá.
    const abandonado = { isOnline: true, lastSeenAt: iso(45 * 60 * 1000) };
    expect(abandonado.isOnline).toBe(true);
    expect(isAvailableNow(abandonado, NOW)).toBe(false);
  });
});
