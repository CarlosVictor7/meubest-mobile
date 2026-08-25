/**
 * SENTINELA — compliance Apple (Guideline 3.1.1 / 1.1.4).
 * No iOS NENHUMA superfície financeira pode existir: carteira, saldo, Pix,
 * saque, gorjetas, coins. Se este teste quebrar, o build iOS NÃO pode subir.
 */
describe('platformFeatures — sentinela iOS', () => {
  afterEach(() => jest.resetModules());

  function load(os: 'ios' | 'android') {
    jest.doMock('react-native', () => ({ Platform: { OS: os, select: (o: any) => o[os] ?? o.default } }));
    return require('../platformFeatures') as typeof import('../platformFeatures');
  }

  it('iOS: FINANCIAL_FEATURES_ENABLED e COINS_FEATURES_ENABLED são false', () => {
    const f = load('ios');
    expect(f.FINANCIAL_FEATURES_ENABLED).toBe(false);
    expect(f.COINS_FEATURES_ENABLED).toBe(false);
  });

  it('Android: financeiro e coins continuam ligados', () => {
    const f = load('android');
    expect(f.FINANCIAL_FEATURES_ENABLED).toBe(true);
    expect(f.COINS_FEATURES_ENABLED).toBe(true);
  });
});
