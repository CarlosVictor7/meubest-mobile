/**
 * Desde 24/08 a VISIBILIDADE do Explorar (próprio usuário, bloqueio nos dois
 * sentidos, aprovação, modo Acolher, consentimento de foto) e a APLICAÇÃO dos
 * filtros são do servidor (`GET /explore/listeners`). Os testes de
 * `isVisibleInExplore`/`isBlockedEitherWay`/`buildExploreList` saíram junto com
 * as funções — a cobertura equivalente vive na meubest-api. Aqui fica só a
 * serialização do estado de filtro em params.
 */
import { toExploreListenersParams } from '../exploreFilters';

describe('toExploreListenersParams', () => {
  it('estado vazio → todos os params ausentes', () => {
    expect(toExploreListenersParams({})).toEqual({
      search: undefined,
      state: undefined,
      theme: undefined,
      religion: undefined,
      ageRange: undefined,
      onlyReachable: undefined,
    });
  });

  it('mapeia themeId → theme e onlyOnline → onlyReachable', () => {
    const p = toExploreListenersParams({
      search: ' ana ',
      state: 'SP',
      themeId: 'ansiedade',
      religion: 'espirita',
      ageRange: '26-40',
      onlyOnline: true,
    });
    expect(p).toEqual({
      search: 'ana',
      state: 'SP',
      theme: 'ansiedade',
      religion: 'espirita',
      ageRange: '26-40',
      onlyReachable: true,
    });
  });

  it('quick-toggle do header ("DISPONÍVEIS AGORA") é o MESMO onlyOnline da sheet → onlyReachable', () => {
    // O header e a sheet compartilham o estado; o param enviado não muda.
    const fromHeader = toExploreListenersParams({ onlyOnline: true });
    const fromSheet = toExploreListenersParams({ onlyOnline: true, search: '', state: '' });
    expect(fromHeader).toEqual(fromSheet);
    expect(fromHeader).toEqual({
      search: undefined,
      state: undefined,
      theme: undefined,
      religion: undefined,
      ageRange: undefined,
      onlyReachable: true,
    });
  });

  it('strings vazias e onlyOnline=false são omitidos', () => {
    const p = toExploreListenersParams({
      search: '   ',
      state: '',
      themeId: '',
      religion: '',
      ageRange: '',
      onlyOnline: false,
    });
    expect(p.search).toBeUndefined();
    expect(p.state).toBeUndefined();
    expect(p.theme).toBeUndefined();
    expect(p.religion).toBeUndefined();
    expect(p.ageRange).toBeUndefined();
    expect(p.onlyReachable).toBeUndefined();
  });
});
