import { normalize } from '@shared/components/SelectSheet/normalize';

describe('normalize — busca tolerante a acento e caixa', () => {
  it('remove acentos', () => {
    expect(normalize('São Paulo')).toBe('sao paulo');
    expect(normalize('Goiânia')).toBe('goiania');
    expect(normalize('Açaí')).toBe('acai');
    expect(normalize('Ceará')).toBe('ceara');
  });

  it('baixa a caixa', () => {
    expect(normalize('MINAS GERAIS')).toBe('minas gerais');
  });

  it('apara espaços nas pontas', () => {
    expect(normalize('  Bahia  ')).toBe('bahia');
  });

  it('trata cedilha e til juntos', () => {
    expect(normalize('CONCEIÇÃO')).toBe('conceicao');
  });

  it('é idempotente', () => {
    expect(normalize(normalize('São Paulo'))).toBe('sao paulo');
  });

  it('trata string vazia e entrada inválida', () => {
    expect(normalize('')).toBe('');
    expect(normalize(undefined as unknown as string)).toBe('');
    expect(normalize(null as unknown as string)).toBe('');
  });

  it('permite achar "sao" digitando "são" e vice-versa', () => {
    const opcao = normalize('São Gonçalo');
    expect(opcao.includes(normalize('sao'))).toBe(true);
    expect(opcao.includes(normalize('SÃO'))).toBe(true);
    expect(opcao.includes(normalize('goncalo'))).toBe(true);
    expect(opcao.includes(normalize('gonçalo'))).toBe(true);
  });
});
