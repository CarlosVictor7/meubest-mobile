import {
  getDisplayName,
  getFirstName,
  getInitial,
  suggestPreferredName,
  normalizeLegacyName,
  DISPLAY_NAME_FALLBACK,
} from '../displayName';

describe('getDisplayName', () => {
  it('usa preferredName quando existe', () => {
    expect(getDisplayName({ preferredName: 'Aninha', name: 'Ana Maria Souza' })).toBe('Aninha');
  });

  it('cai em name quando não há preferredName', () => {
    expect(getDisplayName({ name: 'Ana Maria Souza' })).toBe('Ana Maria Souza');
  });

  it('cai em name quando preferredName é só espaço em branco', () => {
    expect(getDisplayName({ preferredName: '   ', name: 'Ana' })).toBe('Ana');
  });

  it('apara espaços nas duas pontas', () => {
    expect(getDisplayName({ preferredName: '  Aninha  ' })).toBe('Aninha');
    expect(getDisplayName({ name: '  Ana Maria  ' })).toBe('Ana Maria');
  });

  it('usa o fallback padrão quando não há nome nenhum', () => {
    expect(getDisplayName({})).toBe(DISPLAY_NAME_FALLBACK);
    expect(getDisplayName({ preferredName: '', name: '' })).toBe(DISPLAY_NAME_FALLBACK);
    expect(getDisplayName({ preferredName: null, name: null })).toBe(DISPLAY_NAME_FALLBACK);
  });

  it('aceita null e undefined como perfil', () => {
    expect(getDisplayName(null)).toBe(DISPLAY_NAME_FALLBACK);
    expect(getDisplayName(undefined)).toBe(DISPLAY_NAME_FALLBACK);
  });

  it('respeita um fallback customizado — inclusive string vazia', () => {
    expect(getDisplayName({}, 'Voluntário')).toBe('Voluntário');
    expect(getDisplayName(null, '')).toBe('');
  });

  it('não deixa o preferredName vazar para o name — são campos independentes', () => {
    const profile = { preferredName: 'Bia', name: 'Beatriz Lima' };
    getDisplayName(profile);
    expect(profile.name).toBe('Beatriz Lima');
  });
});

describe('getFirstName', () => {
  it('pega o primeiro nome do nome público', () => {
    expect(getFirstName({ name: 'Ana Maria Souza' })).toBe('Ana');
  });

  it('prioriza o preferredName', () => {
    expect(getFirstName({ preferredName: 'Bia Lima', name: 'Beatriz Souza' })).toBe('Bia');
  });

  it('funciona com nome único', () => {
    expect(getFirstName({ name: 'Ana' })).toBe('Ana');
  });

  it('colapsa espaços repetidos no meio', () => {
    expect(getFirstName({ name: 'Ana   Maria' })).toBe('Ana');
  });

  it('ignora espaços à esquerda', () => {
    expect(getFirstName({ name: '   Ana Maria' })).toBe('Ana');
  });

  it('usa o fallback quando não há nome', () => {
    expect(getFirstName({})).toBe(DISPLAY_NAME_FALLBACK);
    expect(getFirstName(null, 'amigo(a)')).toBe('amigo(a)');
  });
});

describe('getInitial', () => {
  it('devolve a primeira letra em maiúscula', () => {
    expect(getInitial({ name: 'ana maria' })).toBe('A');
    expect(getInitial({ preferredName: 'bia' })).toBe('B');
  });

  it('devolve U quando não há nome', () => {
    expect(getInitial({})).toBe('U');
    expect(getInitial(null)).toBe('U');
  });

  it('funciona com nome acentuado', () => {
    expect(getInitial({ name: 'Ândrea' })).toBe('Â');
  });
});

describe('suggestPreferredName', () => {
  it('sugere o primeiro nome do provider', () => {
    expect(suggestPreferredName({ name: 'Ana Maria Souza' })).toBe('Ana');
  });

  it('devolve string vazia quando não há nome — o campo nasce em branco', () => {
    expect(suggestPreferredName({})).toBe('');
    expect(suggestPreferredName(null)).toBe('');
    expect(suggestPreferredName({ name: '   ' })).toBe('');
  });

  it('a sugestão já nasce sem o + legado', () => {
    // A semente do campo "Como você quer ser chamado?" não pode propagar a
    // contaminação: quem salvar sem editar fica com preferredName limpo.
    expect(suggestPreferredName({ name: 'Carlos+Victor Farias' })).toBe('Carlos');
  });
});

describe('normalizeLegacyName — o + do provider', () => {
  it('o caso real de produção', () => {
    expect(normalizeLegacyName('Carlos+Victor Farias')).toBe('Carlos Victor Farias');
  });

  it('múltiplos + e + nas pontas', () => {
    expect(normalizeLegacyName('A+B+C')).toBe('A B C');
    expect(normalizeLegacyName('+Ana+')).toBe('Ana');
  });

  it('colapsa whitespace repetido', () => {
    expect(normalizeLegacyName('Ana + Maria')).toBe('Ana Maria');
    expect(normalizeLegacyName('  Ana   Maria  ')).toBe('Ana Maria');
  });

  it('nome sem + passa intacto', () => {
    expect(normalizeLegacyName('Ana Maria')).toBe('Ana Maria');
  });

  it('entradas inválidas → string vazia, sem lançar', () => {
    expect(normalizeLegacyName(null)).toBe('');
    expect(normalizeLegacyName(undefined)).toBe('');
    expect(normalizeLegacyName(42 as any)).toBe('');
  });
});

describe('integração: o + no fallback vs a escolha do usuário', () => {
  it('name legado com + é normalizado na exibição — sem migração', () => {
    expect(getDisplayName({ name: 'Carlos+Victor Farias' })).toBe('Carlos Victor Farias');
    expect(getFirstName({ name: 'Carlos+Victor Farias' })).toBe('Carlos');
    expect(getInitial({ name: '+Carlos' })).toBe('C');
  });

  it('preferredName com + é PRESERVADO — a escolha do usuário vence', () => {
    expect(
      getDisplayName({ preferredName: 'C+V', name: 'Carlos+Victor Farias' })
    ).toBe('C+V');
  });

  it('preferredName sempre vence o fallback normalizado', () => {
    expect(
      getDisplayName({ preferredName: 'Cacau', name: 'Carlos+Victor Farias' })
    ).toBe('Cacau');
  });

  it('name feito só de + cai no fallback final', () => {
    expect(getDisplayName({ name: '+++' })).toBe(DISPLAY_NAME_FALLBACK);
  });
});
