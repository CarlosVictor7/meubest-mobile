import { buildExploreQueryString } from '../exploreQueryString';

describe('buildExploreQueryString', () => {
  it('sem params → string vazia (sem "?")', () => {
    expect(buildExploreQueryString({})).toBe('');
  });

  it('serializa todos os filtros no contrato da API', () => {
    expect(
      buildExploreQueryString({
        search: 'ana',
        state: 'SP',
        theme: 'ansiedade',
        religion: 'matriz_africana',
        ageRange: '60+',
        onlyReachable: true,
        limit: 12,
        offset: 24,
      })
    ).toBe(
      '?search=ana&state=SP&theme=ansiedade&religion=matriz_africana&ageRange=60%2B&onlyReachable=true&limit=12&offset=24'
    );
  });

  it('omite vazios, onlyReachable=false e offset ausente', () => {
    expect(buildExploreQueryString({ search: '', state: '', onlyReachable: false, limit: 12 })).toBe(
      '?limit=12'
    );
  });

  it('offset 0 é enviado (é um número válido)', () => {
    expect(buildExploreQueryString({ offset: 0 })).toBe('?offset=0');
  });

  it('escapa acentos e espaços na busca', () => {
    expect(buildExploreQueryString({ search: 'João da Silva' })).toBe(
      '?search=Jo%C3%A3o%20da%20Silva'
    );
  });

  it('busca só de espaços é omitida', () => {
    expect(buildExploreQueryString({ search: '   ' })).toBe('');
  });
});
