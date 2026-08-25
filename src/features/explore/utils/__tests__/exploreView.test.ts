import {
  formatAgeRange,
  formatLocation,
  formatExploreProgress,
  getTalkNowAvailability,
  getThemeChips,
  countActiveFilters,
  MAX_THEME_CHIPS,
} from '../exploreView';

describe('formatAgeRange', () => {
  it('troca hífen por en-dash e acrescenta "anos"', () => {
    expect(formatAgeRange('26-40')).toBe('26–40 anos');
    expect(formatAgeRange('18-25')).toBe('18–25 anos');
  });

  it('faixa aberta fica como está', () => {
    expect(formatAgeRange('60+')).toBe('60+ anos');
  });

  it('ausente/vazio → null (linha omitida)', () => {
    expect(formatAgeRange(undefined)).toBeNull();
    expect(formatAgeRange(null)).toBeNull();
    expect(formatAgeRange('   ')).toBeNull();
  });
});

describe('formatLocation', () => {
  it('cidade composta vence a UF', () => {
    expect(formatLocation('São Paulo - SP', 'SP')).toBe('São Paulo - SP');
  });

  it('sem cidade, cai para a UF', () => {
    expect(formatLocation('', 'RJ')).toBe('RJ');
    expect(formatLocation(undefined, 'RJ')).toBe('RJ');
  });

  it('ambos ausentes → null (linha omitida)', () => {
    expect(formatLocation(undefined, undefined)).toBeNull();
    expect(formatLocation('  ', '')).toBeNull();
  });
});

describe('formatExploreProgress', () => {
  it('é 1-based: "3 de 12" para o índice 2', () => {
    expect(formatExploreProgress(2, 12)).toBe('3 de 12');
    expect(formatExploreProgress(0, 1)).toBe('1 de 1');
  });

  it('clampa índices fora da lista', () => {
    expect(formatExploreProgress(-1, 5)).toBe('1 de 5');
    expect(formatExploreProgress(99, 5)).toBe('5 de 5');
  });

  it('lista vazia → string vazia', () => {
    expect(formatExploreProgress(0, 0)).toBe('');
  });
});

describe('getTalkNowAvailability', () => {
  // Desde 24/08 o critério (aprovado E opt-in manual OU agenda agora; presença
  // fresca) é calculado no servidor e chega pronto no DTO público.
  it('reachable + liveNow habilitam CTA e pontinho', () => {
    const r = getTalkNowAvailability({ reachable: true, liveNow: true });
    expect(r.canTalkNow).toBe(true);
    expect(r.liveNow).toBe(true);
  });

  it('reachable sem presença fresca: CTA sim, "Ativo agora" não', () => {
    const r = getTalkNowAvailability({ reachable: true, liveNow: false });
    expect(r.canTalkNow).toBe(true);
    expect(r.liveNow).toBe(false);
  });

  it('não reachable: CTA desabilitado mesmo com presença', () => {
    const r = getTalkNowAvailability({ reachable: false, liveNow: true });
    expect(r.canTalkNow).toBe(false);
    expect(r.liveNow).toBe(true);
  });

  it('perfil nulo é indisponível', () => {
    const r = getTalkNowAvailability(null);
    expect(r.canTalkNow).toBe(false);
    expect(r.liveNow).toBe(false);
  });
});

describe('getThemeChips', () => {
  it('resolve até o máximo e conta o excedente no "+N"', () => {
    const r = getThemeChips(['ansiedade', 'luto', 'carreira', 'familia', 'estudos']);
    expect(r.chips).toHaveLength(MAX_THEME_CHIPS);
    expect(r.chips[0]).toEqual({ id: 'ansiedade', label: 'Ansiedade', emoji: '😓' });
    expect(r.extra).toBe(2);
  });

  it('ids desconhecidos não viram chip nem contam no "+N"', () => {
    const r = getThemeChips(['ansiedade', 'id-orfao']);
    expect(r.chips).toHaveLength(1);
    expect(r.extra).toBe(0);
  });

  it('lista ausente → vazio', () => {
    expect(getThemeChips(undefined)).toEqual({ chips: [], extra: 0 });
    expect(getThemeChips(null)).toEqual({ chips: [], extra: 0 });
  });
});

describe('countActiveFilters', () => {
  it('conta cada filtro ativo uma vez', () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ search: 'ana' })).toBe(1);
    expect(
      countActiveFilters({ search: 'ana', state: 'SP', themeId: 'luto', onlyOnline: true })
    ).toBe(4);
    expect(
      countActiveFilters({
        search: 'ana',
        state: 'SP',
        themeId: 'luto',
        religion: 'espirita',
        ageRange: '26-40',
        onlyOnline: true,
      })
    ).toBe(6);
  });

  it('busca só de espaços não conta', () => {
    expect(countActiveFilters({ search: '   ' })).toBe(0);
  });
});
