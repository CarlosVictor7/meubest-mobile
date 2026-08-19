import {
  formatAgeRange,
  formatLocation,
  formatExploreProgress,
  getTalkNowAvailability,
  getThemeChips,
  countActiveFilters,
  MAX_THEME_CHIPS,
} from '../exploreView';

const NOW = Date.parse('2026-08-18T15:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

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
  it('opt-in manual ligado habilita o CTA', () => {
    const r = getTalkNowAvailability(
      { role: 'listener', listenerStatus: 'approved', isOnline: true, lastSeenAt: iso(60_000) },
      NOW
    );
    expect(r.canTalkNow).toBe(true);
    expect(r.liveNow).toBe(true);
  });

  it('quem não pode acolher nunca habilita', () => {
    const r = getTalkNowAvailability(
      { role: 'speaker', isOnline: true, lastSeenAt: iso(1000) },
      NOW
    );
    expect(r.canTalkNow).toBe(false);
  });

  it('agenda ativa agora habilita mesmo com a chave desligada (regra da push)', () => {
    // NOW é 15:00 UTC — a chave de data/hora local do runtime de teste (UTC).
    const now = new Date(NOW);
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hourKey = `${String(now.getHours()).padStart(2, '0')}:00`;
    const r = getTalkNowAvailability(
      {
        role: 'listener',
        listenerStatus: 'approved',
        isOnline: false,
        availability: { [dateKey]: [hourKey] },
      },
      NOW
    );
    expect(r.canTalkNow).toBe(true);
    // ...mas sem presença fresca declarada não há pontinho "Ativo agora".
    expect(r.liveNow).toBe(false);
  });

  it('sem opt-in e sem agenda: CTA desabilitado', () => {
    const r = getTalkNowAvailability({ role: 'listener', listenerStatus: 'approved', isOnline: false }, NOW);
    expect(r.canTalkNow).toBe(false);
    expect(r.liveNow).toBe(false);
  });

  it('presença obsoleta desliga o "Ativo agora" mas mantém o CTA (opt-in vale)', () => {
    const r = getTalkNowAvailability(
      { role: 'listener', listenerStatus: 'approved', isOnline: true, lastSeenAt: iso(60 * 60 * 1000) },
      NOW
    );
    expect(r.canTalkNow).toBe(true);
    expect(r.liveNow).toBe(false);
  });

  it('perfil nulo é indisponível', () => {
    const r = getTalkNowAvailability(null, NOW);
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
  });

  it('busca só de espaços não conta', () => {
    expect(countActiveFilters({ search: '   ' })).toBe(0);
  });
});
