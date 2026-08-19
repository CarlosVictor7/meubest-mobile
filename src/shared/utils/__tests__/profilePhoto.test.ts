import { getDisplayPhotoUrl } from '../profilePhoto';

describe('getDisplayPhotoUrl', () => {
  it('prioriza a foto enviada no Meu Best (profilePhotoURL)', () => {
    expect(
      getDisplayPhotoUrl({
        profilePhotoURL: 'https://storage/avatar.jpg',
        photoURL: 'https://google/foto.jpg',
      })
    ).toBe('https://storage/avatar.jpg');
  });

  it('cai para a foto legada do provider quando não há foto própria', () => {
    expect(getDisplayPhotoUrl({ photoURL: 'https://google/foto.jpg' })).toBe(
      'https://google/foto.jpg'
    );
    expect(
      getDisplayPhotoUrl({ profilePhotoURL: undefined, photoURL: 'https://google/foto.jpg' })
    ).toBe('https://google/foto.jpg');
  });

  it('string vazia ou só espaços conta como ausente — nunca "vence" o fallback', () => {
    expect(
      getDisplayPhotoUrl({ profilePhotoURL: '', photoURL: 'https://google/foto.jpg' })
    ).toBe('https://google/foto.jpg');
    expect(
      getDisplayPhotoUrl({ profilePhotoURL: '   ', photoURL: 'https://google/foto.jpg' })
    ).toBe('https://google/foto.jpg');
    expect(getDisplayPhotoUrl({ profilePhotoURL: '', photoURL: '' })).toBeNull();
    expect(getDisplayPhotoUrl({ profilePhotoURL: '  ', photoURL: '  ' })).toBeNull();
  });

  it('sem nenhuma foto → null (a UI cai para a inicial)', () => {
    expect(getDisplayPhotoUrl({})).toBeNull();
    expect(getDisplayPhotoUrl({ profilePhotoURL: null, photoURL: null })).toBeNull();
    expect(getDisplayPhotoUrl(null)).toBeNull();
    expect(getDisplayPhotoUrl(undefined)).toBeNull();
  });
});
