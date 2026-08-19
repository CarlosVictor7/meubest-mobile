import {
  isBlockedEitherWay,
  isVisibleInExplore,
  matchesLocation,
  matchesSearch,
  matchesTheme,
  buildExploreList,
  type ExploreCandidate,
} from '../exploreFilters';

const NOW = Date.parse('2026-08-18T15:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const viewer = { uid: 'eu', blockedUserIds: [] as string[] };

const acolhedor = (over: Partial<ExploreCandidate> = {}): ExploreCandidate => ({
  id: 'a1',
  role: 'listener',
  listenerStatus: 'approved',
  name: 'Ana Souza',
  bio: 'Gosto de ouvir.',
  state: 'SP',
  city: 'São Paulo - SP',
  interests: ['ansiedade'],
  isOnline: true,
  lastSeenAt: iso(60_000),
  ...over,
});

describe('isBlockedEitherWay', () => {
  it('vale quando eu bloqueei', () => {
    expect(isBlockedEitherWay(acolhedor(), { uid: 'eu', blockedUserIds: ['a1'] })).toBe(true);
  });

  it('vale quando ele me bloqueou', () => {
    expect(isBlockedEitherWay(acolhedor({ blockedUserIds: ['eu'] }), viewer)).toBe(true);
  });

  it('é falso quando não há bloqueio', () => {
    expect(isBlockedEitherWay(acolhedor(), viewer)).toBe(false);
  });

  it('trata listas ausentes como sem bloqueio', () => {
    expect(isBlockedEitherWay({ id: 'a1' }, { uid: 'eu' })).toBe(false);
  });
});

describe('isVisibleInExplore', () => {
  it('mostra acolhedor comum', () => {
    expect(isVisibleInExplore(acolhedor(), viewer)).toBe(true);
  });

  it('nunca mostra o próprio usuário', () => {
    expect(isVisibleInExplore(acolhedor({ id: 'eu' }), viewer)).toBe(false);
  });

  it('não mostra quem eu bloqueei', () => {
    expect(isVisibleInExplore(acolhedor(), { uid: 'eu', blockedUserIds: ['a1'] })).toBe(false);
  });

  it('não mostra quem me bloqueou', () => {
    expect(isVisibleInExplore(acolhedor({ blockedUserIds: ['eu'] }), viewer)).toBe(false);
  });

  it('não mostra quem não pode acolher', () => {
    expect(isVisibleInExplore(acolhedor({ role: 'speaker' }), viewer)).toBe(false);
  });

  it('não mostra candidato sem id', () => {
    expect(isVisibleInExplore({ id: '' }, viewer)).toBe(false);
  });

  /**
   * ⚠️ Este teste descreve o estado PERMISSIVO da Sprint 2. Quando a Sprint 6
   * trocar `canActAsListener`, ele deve falhar — é essa falha que prova que o
   * Explorar passou a respeitar o enforcement sem alterar `exploreFilters`.
   */
  it('ENFORCEMENT (19/08): listener sem aprovação NÃO aparece mais', () => {
    expect(isVisibleInExplore(acolhedor({ listenerStatus: 'not_requested' }), viewer)).toBe(false);
    expect(isVisibleInExplore(acolhedor({ listenerStatus: 'rejected' }), viewer)).toBe(false);
    expect(isVisibleInExplore(acolhedor({ listenerStatus: undefined }), viewer)).toBe(false);
  });

  it('aprovado em modo Desabafar também não aparece (role é o modo)', () => {
    expect(isVisibleInExplore(acolhedor({ role: 'speaker' }), viewer)).toBe(false);
  });
});

describe('filtros individuais', () => {
  it('busca por nome público, tolerante a acento', () => {
    const c = acolhedor({ name: 'Antônio Gonçalves' });
    expect(matchesSearch(c, 'antonio')).toBe(true);
    expect(matchesSearch(c, 'GONCALVES')).toBe(true);
    expect(matchesSearch(c, 'zebra')).toBe(false);
  });

  it('busca prioriza preferredName', () => {
    const c = acolhedor({ name: 'Beatriz Lima', preferredName: 'Bia' });
    expect(matchesSearch(c, 'bia')).toBe(true);
  });

  it('busca também na bio', () => {
    expect(matchesSearch(acolhedor({ bio: 'Escuto sobre luto' }), 'luto')).toBe(true);
  });

  it('busca vazia deixa todo mundo passar', () => {
    expect(matchesSearch(acolhedor(), '')).toBe(true);
    expect(matchesSearch(acolhedor(), undefined)).toBe(true);
  });

  it('localização filtra por UF, não por cidade', () => {
    expect(matchesLocation(acolhedor(), 'SP')).toBe(true);
    expect(matchesLocation(acolhedor(), 'RJ')).toBe(false);
    expect(matchesLocation(acolhedor(), undefined)).toBe(true);
  });

  it('tema exige o id na lista de interesses', () => {
    expect(matchesTheme(acolhedor(), 'ansiedade')).toBe(true);
    expect(matchesTheme(acolhedor(), 'luto')).toBe(false);
    expect(matchesTheme(acolhedor({ interests: undefined }), 'luto')).toBe(false);
    expect(matchesTheme(acolhedor(), undefined)).toBe(true);
  });
});

describe('buildExploreList', () => {
  const online = acolhedor({ id: 'online', name: 'Zara', isOnline: true, lastSeenAt: iso(1000) });
  const offline = acolhedor({ id: 'offline', name: 'Ana', isOnline: false });
  const obsoleto = acolhedor({
    id: 'obsoleto',
    name: 'Bruno',
    isOnline: true,
    lastSeenAt: iso(60 * 60 * 1000),
  });
  const bloqueado = acolhedor({ id: 'bloqueado', blockedUserIds: ['eu'] });
  const naoAcolhedor = acolhedor({ id: 'speaker', role: 'speaker' });

  const todos = [offline, online, obsoleto, bloqueado, naoAcolhedor];

  it('coloca quem está disponível agora no topo', () => {
    const r = buildExploreList(todos, viewer, {}, NOW);
    expect(r[0].id).toBe('online');
  });

  it('trata presença obsoleta como indisponível na ordenação', () => {
    const r = buildExploreList([obsoleto, online], viewer, {}, NOW);
    expect(r.map((c) => c.id)).toEqual(['online', 'obsoleto']);
  });

  it('desempata por nome público', () => {
    const r = buildExploreList([obsoleto, offline], viewer, {}, NOW);
    expect(r.map((c) => c.id)).toEqual(['offline', 'obsoleto']); // Ana antes de Bruno
  });

  it('remove bloqueados e não-acolhedores', () => {
    const ids = buildExploreList(todos, viewer, {}, NOW).map((c) => c.id);
    expect(ids).not.toContain('bloqueado');
    expect(ids).not.toContain('speaker');
  });

  it('onlyOnline exige presença fresca, não só a chave ligada', () => {
    const ids = buildExploreList(todos, viewer, { onlyOnline: true }, NOW).map((c) => c.id);
    expect(ids).toEqual(['online']);
    // `obsoleto` tem isOnline: true — mas lastSeenAt de uma hora atrás.
    expect(obsoleto.isOnline).toBe(true);
    expect(ids).not.toContain('obsoleto');
  });

  it('combina filtros', () => {
    const r = buildExploreList(todos, viewer, { state: 'SP', themeId: 'ansiedade' }, NOW);
    expect(r.length).toBeGreaterThan(0);
    expect(buildExploreList(todos, viewer, { state: 'RJ' }, NOW)).toEqual([]);
  });

  it('tolera lista nula', () => {
    expect(buildExploreList(null, viewer, {}, NOW)).toEqual([]);
  });
});
