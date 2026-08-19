/**
 * providerPatch — o login social nunca pode destruir dados do perfil.
 *
 * O bug real: `setDoc({ name: displayName, ... }, { merge: true })` com
 * `displayName: null` apagava o nome; `email: null` violava as Rules e negava
 * a escrita inteira, quebrando o login. A Apple devolve tudo nulo a partir do
 * SEGUNDO login — não é caso raro, é o caso normal dela.
 */
import { buildProviderPatch } from '../providerPatch';
import { maskToken } from '../maskToken';

describe('buildProviderPatch', () => {
  it('inclui só o que veio válido e trimado', () => {
    expect(
      buildProviderPatch({
        displayName: '  Ana Souza  ',
        photoURL: 'https://example.com/a.png',
        email: 'ana@example.com',
      })
    ).toEqual({
      name: 'Ana Souza',
      photoURL: 'https://example.com/a.png',
      email: 'ana@example.com',
    });
  });

  it('displayName null/undefined/vazio/espacos → chave name AUSENTE', () => {
    expect(buildProviderPatch({ displayName: null }).name).toBeUndefined();
    expect(buildProviderPatch({ displayName: undefined }).name).toBeUndefined();
    expect(buildProviderPatch({ displayName: '' }).name).toBeUndefined();
    expect(buildProviderPatch({ displayName: '   ' }).name).toBeUndefined();
  });

  it('email null/vazio → chave email AUSENTE (nunca viola as Rules)', () => {
    expect(buildProviderPatch({ email: null }).email).toBeUndefined();
    expect(buildProviderPatch({ email: '' }).email).toBeUndefined();
  });

  it('photoURL null → chave AUSENTE (avatar não é apagado)', () => {
    expect(buildProviderPatch({ photoURL: null }).photoURL).toBeUndefined();
  });

  it('tudo nulo → payload VAZIO → o chamador não escreve nada', () => {
    // O cenário Apple a partir do segundo login.
    expect(
      buildProviderPatch({ displayName: null, photoURL: null, email: null })
    ).toEqual({});
    expect(buildProviderPatch({})).toEqual({});
  });

  it('parcial: só o campo presente entra', () => {
    expect(buildProviderPatch({ email: 'x@y.com', displayName: null })).toEqual({
      email: 'x@y.com',
    });
  });

  it('NUNCA contém preferredName, sob nenhuma entrada', () => {
    const patches = [
      buildProviderPatch({ displayName: 'Nome', photoURL: 'u', email: 'e@x.com' }),
      buildProviderPatch({}),
      buildProviderPatch({ displayName: 'preferredName' }),
    ];
    for (const p of patches) {
      expect(Object.keys(p)).not.toContain('preferredName');
    }
  });

  it('nunca produz valor null/undefined/vazio em NENHUMA chave', () => {
    const p = buildProviderPatch({ displayName: ' A ', photoURL: '', email: null });
    for (const v of Object.values(p)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe('maskToken', () => {
  const token = 'ExponentPushToken[djt9DdBPoqIzej3024F09O]';

  it('preserva prefixo e sufixo, esconde o miolo', () => {
    const masked = maskToken(token);
    expect(masked).toBe('ExponentPushToken[…09O]');
  });

  it('a máscara NUNCA contém o miolo do token', () => {
    const masked = maskToken(token);
    expect(masked).not.toContain('djt9DdBPoqIzej3024F09O');
    expect(masked.length).toBeLessThan(token.length);
  });

  it('ausente → rótulo neutro', () => {
    expect(maskToken(undefined)).toBe('(ausente)');
    expect(maskToken(null)).toBe('(ausente)');
    expect(maskToken('')).toBe('(ausente)');
  });

  it('token curto não é devolvido inteiro', () => {
    const short = 'abcdef';
    expect(maskToken(short)).not.toBe(short);
    expect(maskToken(short)).toBe('abcd…');
  });
});
