import { tabsForPlatform, BOTTOM_NAV_TAB_COUNT, type BottomNavTab } from '../tabs';

describe('tabsForPlatform', () => {
  it('Android (financeiro ligado): 4 abas com Carteira, sem Explorar', () => {
    const tabs = tabsForPlatform(true);
    expect(tabs).toEqual(['home', 'sessions', 'wallet', 'menu']);
    expect(tabs).toContain('wallet');
    expect(tabs).not.toContain('explore');
  });

  it('iOS (financeiro desligado): 4 abas com Explorar no lugar da Carteira', () => {
    const tabs = tabsForPlatform(false);
    expect(tabs).toEqual(['home', 'sessions', 'explore', 'menu']);
    expect(tabs).toContain('explore');
    expect(tabs).not.toContain('wallet');
  });

  it('nunca tem slot vazio nem duplicado — sempre 4 abas distintas', () => {
    for (const enabled of [true, false]) {
      const tabs = tabsForPlatform(enabled);
      expect(tabs).toHaveLength(BOTTOM_NAV_TAB_COUNT);
      expect(new Set(tabs).size).toBe(BOTTOM_NAV_TAB_COUNT);
      tabs.forEach((t: BottomNavTab) => expect(typeof t).toBe('string'));
    }
  });

  it('Início e Sessões à esquerda, Menu à direita, nas duas plataformas', () => {
    for (const enabled of [true, false]) {
      const tabs = tabsForPlatform(enabled);
      expect(tabs.slice(0, 2)).toEqual(['home', 'sessions']);
      expect(tabs[3]).toBe('menu');
    }
  });
});
