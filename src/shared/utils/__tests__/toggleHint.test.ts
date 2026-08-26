import {
  shouldShowToggleHint,
  parseToggleHintCount,
  peekDirection,
  TOGGLE_HINT_MAX_SHOWS,
  TOGGLE_PEEK_DISTANCE,
  TOGGLE_PEEK_TOTAL_MS,
} from '../toggleHint';

describe('shouldShowToggleHint', () => {
  it('mostra nas 3 primeiras aberturas', () => {
    expect(shouldShowToggleHint(0, false)).toBe(true);
    expect(shouldShowToggleHint(1, false)).toBe(true);
    expect(shouldShowToggleHint(2, false)).toBe(true);
    expect(TOGGLE_HINT_MAX_SHOWS).toBe(3);
  });

  it('a partir da 4ª abertura nunca mais', () => {
    expect(shouldShowToggleHint(3, false)).toBe(false);
    expect(shouldShowToggleHint(99, false)).toBe(false);
  });

  it('reduzir movimento ligado → nunca, nem na primeira', () => {
    expect(shouldShowToggleHint(0, true)).toBe(false);
  });

  it('contador inválido conta como 0', () => {
    expect(shouldShowToggleHint(NaN, false)).toBe(true);
    expect(shouldShowToggleHint(-1, false)).toBe(true);
  });
});

describe('parseToggleHintCount', () => {
  it('lê o valor persistido e tolera lixo', () => {
    expect(parseToggleHintCount(null)).toBe(0);
    expect(parseToggleHintCount('2')).toBe(2);
    expect(parseToggleHintCount('abc')).toBe(0);
    expect(parseToggleHintCount('-3')).toBe(0);
  });
});

describe('peek', () => {
  it('vai em direção ao lado inativo', () => {
    expect(peekDirection(0, 2)).toBe(1);
    expect(peekDirection(1, 2)).toBe(-1);
    expect(peekDirection(0, 1)).toBe(1);
  });

  it('6–8 px e ~1,2 s no total', () => {
    expect(TOGGLE_PEEK_DISTANCE).toBeGreaterThanOrEqual(6);
    expect(TOGGLE_PEEK_DISTANCE).toBeLessThanOrEqual(8);
    expect(TOGGLE_PEEK_TOTAL_MS).toBe(1200);
  });
});
