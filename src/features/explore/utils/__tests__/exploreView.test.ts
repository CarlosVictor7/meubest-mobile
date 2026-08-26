import {
  formatAgeRange,
  formatLocation,
  formatExploreProgress,
  getTalkNowAvailability,
  getThemeChips,
  countActiveFilters,
  themeChipsState,
  getPresenceBadges,
  bioOverflow,
  MAX_THEME_CHIPS,
  BIO_COLLAPSED_LINES,
} from '../exploreView';

describe('getPresenceBadges — reachable e liveNow são independentes', () => {
  it('reachable + liveNow: pill E ponto', () => {
    const b = getPresenceBadges({ canTalkNow: true, liveNow: true });
    expect(b).toEqual({ showAvailablePill: true, showActiveNow: true, showUnavailableHint: false });
  });

  it('reachable sem liveNow: pill sem ponto (agenda programada, app fechado)', () => {
    const b = getPresenceBadges({ canTalkNow: true, liveNow: false });
    expect(b).toEqual({ showAvailablePill: true, showActiveNow: false, showUnavailableHint: false });
  });

  it('liveNow sem reachable: ponto "Ativo agora" + "Indisponível" — sem pill', () => {
    const b = getPresenceBadges({ canTalkNow: false, liveNow: true });
    expect(b).toEqual({ showAvailablePill: false, showActiveNow: true, showUnavailableHint: true });
  });

  it('nenhum dos dois: só o hint de indisponível', () => {
    const b = getPresenceBadges({ canTalkNow: false, liveNow: false });
    expect(b).toEqual({ showAvailablePill: false, showActiveNow: false, showUnavailableHint: true });
  });

  it('prévia do próprio perfil nunca mostra o hint, mas mantém o ponto', () => {
    const b = getPresenceBadges({ canTalkNow: false, liveNow: true }, true);
    expect(b.showUnavailableHint).toBe(false);
    expect(b.showActiveNow).toBe(true);
  });
});

describe('themeChipsState', () => {
  const seven = ['ansiedade', 'luto', 'carreira', 'familia', 'estudos', 'relacionamento', 'saude'];

  it('0 interesses: vazio, sem toggle', () => {
    expect(themeChipsState([], false)).toEqual({ chips: [], extra: 0, canToggle: false, expanded: false });
    expect(themeChipsState(undefined, true).chips).toHaveLength(0);
  });

  it('1 e 3 interesses: tudo visível, sem "+N" nem toggle', () => {
    const one = themeChipsState(['luto'], false);
    expect(one.chips).toHaveLength(1);
    expect(one.extra).toBe(0);
    expect(one.canToggle).toBe(false);

    const three = themeChipsState(seven.slice(0, 3), false);
    expect(three.chips).toHaveLength(3);
    expect(three.extra).toBe(0);
    expect(three.canToggle).toBe(false);
  });

  it('4 interesses recolhido: 3 chips + "+1"; expandido: 4 chips e sem "+N"', () => {
    const c = themeChipsState(seven.slice(0, 4), false);
    expect(c.chips).toHaveLength(MAX_THEME_CHIPS);
    expect(c.extra).toBe(1);
    expect(c.canToggle).toBe(true);
    expect(c.expanded).toBe(false);

    const e = themeChipsState(seven.slice(0, 4), true);
    expect(e.chips).toHaveLength(4);
    expect(e.extra).toBe(0);
    expect(e.canToggle).toBe(true);
    expect(e.expanded).toBe(true);
  });

  it('7 interesses: "+4" recolhido; todos os 7 expandido; collapse volta ao "+4"', () => {
    const collapsed = themeChipsState(seven, false);
    expect(collapsed.extra).toBe(4);
    const expanded = themeChipsState(seven, true);
    expect(expanded.chips.map((c) => c.id)).toEqual(seven);
    expect(expanded.extra).toBe(0);
    expect(themeChipsState(seven, false)).toEqual(collapsed);
  });

  it('expandido com ≤ max: não há o que expandir → expanded false', () => {
    expect(themeChipsState(['luto'], true).expanded).toBe(false);
  });

  it('ids órfãos não entram nem contam', () => {
    const r = themeChipsState(['ansiedade', 'x', 'y', 'z'], false);
    expect(r.chips).toHaveLength(1);
    expect(r.canToggle).toBe(false);
  });
});

describe('bioOverflow', () => {
  it('2 e 3 linhas cabem no recolhido → sem VER MAIS', () => {
    expect(bioOverflow(2)).toBe(false);
    expect(bioOverflow(3)).toBe(false);
    expect(BIO_COLLAPSED_LINES).toBe(3);
  });

  it('4 linhas transbordam → VER MAIS', () => {
    expect(bioOverflow(4)).toBe(true);
  });

  it('não medido (reset por uid) → sem botão até medir de novo', () => {
    expect(bioOverflow(null)).toBe(false);
    expect(bioOverflow(undefined)).toBe(false);
    expect(bioOverflow(NaN)).toBe(false);
  });

  it('respeita collapsedLines custom', () => {
    expect(bioOverflow(3, 2)).toBe(true);
    expect(bioOverflow(5, 5)).toBe(false);
  });
});

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
