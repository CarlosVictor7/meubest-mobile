/**
 * tabs — quais abas o BottomNav mostra, por plataforma. Função PURA (sem
 * ícones, sem React) para ser testável em node.
 *
 *   Android (financeiro ligado):  [home, sessions, wallet,  menu]
 *   iOS     (financeiro desligado): [home, sessions, explore, menu]
 *
 * O slot da Carteira no iOS não fica vazio nem vira placeholder financeiro
 * (Guideline 1.1.4): recebe o Explorar. Sempre 4 abas — 2 de cada lado do
 * botão COMEÇAR — para o layout `half` + `centerGap` não divergir.
 */
export type BottomNavTab = 'home' | 'sessions' | 'wallet' | 'explore' | 'menu';

export const BOTTOM_NAV_TAB_COUNT = 4;

export function tabsForPlatform(financialEnabled: boolean): BottomNavTab[] {
  return financialEnabled
    ? ['home', 'sessions', 'wallet', 'menu']
    : ['home', 'sessions', 'explore', 'menu'];
}
