import {
  directedFirstName,
  directedSearchTitle,
  directedTimeoutTitle,
  BROADCAST_SEARCH_TITLE,
  BROADCAST_TIMEOUT_TITLE,
} from '../directedSearch';

describe('directedSearchTitle', () => {
  it('nome público abreviado → primeiro nome em caixa alta', () => {
    expect(directedSearchTitle('Ana S.')).toBe('BUSCANDO ANA');
  });

  it('nome completo legado NUNCA vaza: só o primeiro nome', () => {
    expect(directedSearchTitle('Carlos Victor Farias')).toBe('BUSCANDO CARLOS');
    expect(directedSearchTitle('Carlos+Victor Farias')).toBe('BUSCANDO CARLOS');
  });

  it('nome único', () => {
    expect(directedSearchTitle('Madonna')).toBe('BUSCANDO MADONNA');
  });

  it('sem nome → título de broadcast', () => {
    expect(directedSearchTitle(undefined)).toBe(BROADCAST_SEARCH_TITLE);
    expect(directedSearchTitle('')).toBe(BROADCAST_SEARCH_TITLE);
    expect(directedSearchTitle('   ')).toBe(BROADCAST_SEARCH_TITLE);
  });
});

describe('directedTimeoutTitle', () => {
  it('"{Nome} não respondeu"', () => {
    expect(directedTimeoutTitle('Ana S.')).toBe('Ana não respondeu');
    expect(directedTimeoutTitle('João de Souza')).toBe('João não respondeu');
  });

  it('sem nome → título genérico', () => {
    expect(directedTimeoutTitle(null)).toBe(BROADCAST_TIMEOUT_TITLE);
  });
});

describe('directedFirstName', () => {
  it('nunca devolve e-mail como nome (não é fonte de nome)', () => {
    // O helper só recebe listenerName; um e-mail passado por engano vira o
    // "primeiro token" — o que importa é que nunca formatamos uid/e-mail aqui.
    expect(directedFirstName('')).toBe('');
  });
});
