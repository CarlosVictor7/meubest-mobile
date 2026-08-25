import {
  mergeExplorePages,
  shouldPrefetchNextPage,
  shouldAutoFillFilteredPage,
  EXPLORE_PAGE_SIZE,
  EXPLORE_PREFETCH_AHEAD,
  EXPLORE_MAX_AUTOFILL_PAGES,
} from '../explorePaging';

// `buildExploreQueryConstraintSpecs` (WHERE do Firestore) saiu em 24/08: a
// query agora é da API, que decide role/aprovação server-side.

describe('mergeExplorePages', () => {
  const a = { uid: 'a', publicName: 'Ana' };
  const b = { uid: 'b', publicName: 'Bia' };
  const c = { uid: 'c', publicName: 'Caio' };

  it('concatena página nova preservando a ordem existente', () => {
    expect(mergeExplorePages([a, b], [c])).toEqual([a, b, c]);
  });

  it('deduplica por uid — o perfil existente vence', () => {
    const bDuplicado = { uid: 'b', publicName: 'Bia Atualizada' };
    const r = mergeExplorePages([a, b], [bDuplicado, c]);
    expect(r).toEqual([a, b, c]);
    expect(r[1].publicName).toBe('Bia');
  });

  it('deduplica dentro da própria página nova', () => {
    expect(mergeExplorePages([], [a, a, b])).toEqual([a, b]);
  });

  it('ignora itens sem uid', () => {
    expect(mergeExplorePages([a], [{ uid: '', publicName: 'Fantasma' }, b])).toEqual([a, b]);
  });

  it('devolve a MESMA referência quando nada novo chega (evita re-render)', () => {
    const existing = [a, b];
    expect(mergeExplorePages(existing, [a])).toBe(existing);
    expect(mergeExplorePages(existing, [])).toBe(existing);
  });
});

describe('shouldPrefetchNextPage', () => {
  const base = { loadedCount: 12, hasMore: true, isFetching: false };

  it('não busca longe do fim', () => {
    expect(shouldPrefetchNextPage({ ...base, currentIndex: 0 })).toBe(false);
    expect(
      shouldPrefetchNextPage({ ...base, currentIndex: 12 - EXPLORE_PREFETCH_AHEAD - 1 })
    ).toBe(false);
  });

  it('busca ao chegar a (carregados - antecedência)', () => {
    expect(
      shouldPrefetchNextPage({ ...base, currentIndex: 12 - EXPLORE_PREFETCH_AHEAD })
    ).toBe(true);
    expect(shouldPrefetchNextPage({ ...base, currentIndex: 11 })).toBe(true);
  });

  it('nunca busca sem hasMore', () => {
    expect(
      shouldPrefetchNextPage({ ...base, currentIndex: 11, hasMore: false })
    ).toBe(false);
  });

  it('nunca busca com fetch em andamento (guard de concorrência)', () => {
    expect(
      shouldPrefetchNextPage({ ...base, currentIndex: 11, isFetching: true })
    ).toBe(false);
  });

  it('nunca busca com lista vazia (o primeiro load é de quem chama)', () => {
    expect(
      shouldPrefetchNextPage({ ...base, currentIndex: 0, loadedCount: 0 })
    ).toBe(false);
  });
});

describe('shouldAutoFillFilteredPage', () => {
  const base = {
    hasMore: true,
    isFetching: false,
    pagesAutoFetched: 0,
  };

  it('continua paginando enquanto a lista tem menos de uma página', () => {
    expect(shouldAutoFillFilteredPage({ ...base, filteredCount: 0 })).toBe(true);
    expect(
      shouldAutoFillFilteredPage({ ...base, filteredCount: EXPLORE_PAGE_SIZE - 1 })
    ).toBe(true);
  });

  it('para quando a lista enche uma página', () => {
    expect(
      shouldAutoFillFilteredPage({ ...base, filteredCount: EXPLORE_PAGE_SIZE })
    ).toBe(false);
  });

  it('para no teto de páginas por interação — não varre a base', () => {
    expect(
      shouldAutoFillFilteredPage({
        ...base,
        filteredCount: 0,
        pagesAutoFetched: EXPLORE_MAX_AUTOFILL_PAGES,
      })
    ).toBe(false);
  });

  it('para sem hasMore ou com fetch em andamento', () => {
    expect(
      shouldAutoFillFilteredPage({ ...base, filteredCount: 0, hasMore: false })
    ).toBe(false);
    expect(
      shouldAutoFillFilteredPage({ ...base, filteredCount: 0, isFetching: true })
    ).toBe(false);
  });
});
