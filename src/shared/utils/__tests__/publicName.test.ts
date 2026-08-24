/**
 * getPublicExploreName — regra de privacidade: nome completo NUNCA sai para
 * outro usuário. Os casos abaixo são o contrato (§7/§75 do GO de 24/08).
 */
import { getPublicExploreName, PUBLIC_NAME_FALLBACK } from '../displayName';

describe('getPublicExploreName', () => {
  it.each([
    ['Bárbara Oliveira', 'Bárbara O.'],
    ['Carlos Victor Farias', 'Carlos F.'],
    ['Ana Rita Santana Cruz', 'Ana C.'],
    ['Madonna', 'Madonna'],
    ['Carlos+Victor Farias', 'Carlos F.'],
    ['João de Souza', 'João S.'],
    ['Maria  da   Silva', 'Maria S.'],
    ['  Pedro   ', 'Pedro'],
    ['Maria-Clara Souza', 'Maria-Clara S.'],
    ['João de', 'João'],
    ['Luiz dos Santos e Silva', 'Luiz S.'],
  ])('%s → %s', (input, expected) => {
    expect(getPublicExploreName({ name: input })).toBe(expected);
  });

  it('preferredName tem prioridade sobre name', () => {
    expect(getPublicExploreName({ preferredName: 'Bárbara Oliveira', name: 'Barbara Olivier Souza' })).toBe('Bárbara O.');
  });

  it('preferredName de um token vale como está', () => {
    expect(getPublicExploreName({ preferredName: 'Babi', name: 'Bárbara Oliveira' })).toBe('Babi');
  });

  it('vazio/nulo → fallback (nunca e-mail)', () => {
    expect(getPublicExploreName({ name: '' })).toBe(PUBLIC_NAME_FALLBACK);
    expect(getPublicExploreName(null)).toBe(PUBLIC_NAME_FALLBACK);
    expect(getPublicExploreName({ name: '   ' }, 'X')).toBe('X');
  });

  it('nunca devolve o nome completo quando há sobrenome', () => {
    const out = getPublicExploreName({ name: 'Ana Rita Santana Cruz' });
    expect(out).not.toContain('Santana');
    expect(out).not.toContain('Cruz');
    expect(out.split(' ').length).toBe(2);
  });
});
