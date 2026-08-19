import { LISTENER_APPROVAL_ENFORCED } from '@shared/utils/listener';
import {
  buildExploreQueryConstraintSpecs,
  mergeExplorePages,
  shouldPrefetchNextPage,
  shouldAutoFillFilteredPage,
  EXPLORE_PAGE_SIZE,
  EXPLORE_PREFETCH_AHEAD,
  EXPLORE_MAX_AUTOFILL_PAGES,
} from '../explorePaging';

describe('buildExploreQueryConstraintSpecs', () => {
  it('com a flag LIGADA (estado atual, 19/08): role + approved na query', () => {
    // Garante que o default acompanha a flag real do produto.
    expect(LISTENER_APPROVAL_ENFORCED).toBe(true);
    expect(buildExploreQueryConstraintSpecs()).toEqual([
      ['role', '==', 'listener'],
      ['listenerStatus', '==', 'approved'],
    ]);
  });

  it('ramo explícito flag off: só role == listener', () => {
    expect(buildExploreQueryConstraintSpecs(false)).toEqual([
      ['role', '==', 'listener'],
    ]);
  });

  /**
   * Documenta o comportamento esperado quando o enforcement LIGAR: a query
   * passa a exigir também listenerStatus == 'approved' — é o que a regra de
   * leitura publicada exige para a query ser provável. SEM orderBy em nenhum
   * dos ramos (índice composto role+listenerStatus+name não pode ser criado).
   */
  it('ramo flag on: role == listener E listenerStatus == approved', () => {
    expect(buildExploreQueryConstraintSpecs(true)).toEqual([
      ['role', '==', 'listener'],
      ['listenerStatus', '==', 'approved'],
    ]);
  });
});

describe('mergeExplorePages', () => {
  const a = { id: 'a', name: 'Ana' };
  const b = { id: 'b', name: 'Bia' };
  const c = { id: 'c', name: 'Caio' };

  it('concatena página nova preservando a ordem existente', () => {
    expect(mergeExplorePages([a, b], [c])).toEqual([a, b, c]);
  });

  it('deduplica por id — o doc existente vence', () => {
    const bDuplicado = { id: 'b', name: 'Bia Atualizada' };
    const r = mergeExplorePages([a, b], [bDuplicado, c]);
    expect(r).toEqual([a, b, c]);
    expect(r[1].name).toBe('Bia');
  });

  it('deduplica dentro da própria página nova', () => {
    expect(mergeExplorePages([], [a, a, b])).toEqual([a, b]);
  });

  it('ignora itens sem id', () => {
    expect(mergeExplorePages([a], [{ id: '', name: 'Fantasma' }, b])).toEqual([a, b]);
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

  it('continua paginando enquanto a lista filtrada tem menos de uma página', () => {
    expect(shouldAutoFillFilteredPage({ ...base, filteredCount: 0 })).toBe(true);
    expect(
      shouldAutoFillFilteredPage({ ...base, filteredCount: EXPLORE_PAGE_SIZE - 1 })
    ).toBe(true);
  });

  it('para quando a lista filtrada enche uma página', () => {
    expect(
      shouldAutoFillFilteredPage({ ...base, filteredCount: EXPLORE_PAGE_SIZE })
    ).toBe(false);
  });

  it('para no teto de páginas por interação — não varre a coleção', () => {
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
