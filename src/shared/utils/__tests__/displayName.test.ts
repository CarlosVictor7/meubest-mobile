import {
  getDisplayName,
  getFirstName,
  getInitial,
  suggestPreferredName,
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
});
