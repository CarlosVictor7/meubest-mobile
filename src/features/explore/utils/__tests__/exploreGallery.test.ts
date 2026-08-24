import {
  getGalleryTapZone,
  nextValidPhotoIndex,
  firstValidPhotoIndex,
  getPhotoPrefetchUrls,
  describePhotoUrl,
} from '../exploreGallery';

describe('getGalleryTapZone', () => {
  const W = 300;

  it('40% da esquerda = anterior, 40% da direita = próxima, centro = nada', () => {
    expect(getGalleryTapZone(0, W)).toBe('prev');
    expect(getGalleryTapZone(119, W)).toBe('prev');
    expect(getGalleryTapZone(120, W)).toBe('none');
    expect(getGalleryTapZone(150, W)).toBe('none');
    expect(getGalleryTapZone(180, W)).toBe('none');
    expect(getGalleryTapZone(181, W)).toBe('next');
    expect(getGalleryTapZone(300, W)).toBe('next');
  });

  it('fora do card ou largura inválida → nada', () => {
    expect(getGalleryTapZone(-1, W)).toBe('none');
    expect(getGalleryTapZone(301, W)).toBe('none');
    expect(getGalleryTapZone(10, 0)).toBe('none');
    expect(getGalleryTapZone(Number.NaN, W)).toBe('none');
  });
});

describe('nextValidPhotoIndex', () => {
  it('avança e recua sem wrap', () => {
    expect(nextValidPhotoIndex(3, 0, 1)).toBe(1);
    expect(nextValidPhotoIndex(3, 2, 1)).toBeNull();
    expect(nextValidPhotoIndex(3, 2, -1)).toBe(1);
    expect(nextValidPhotoIndex(3, 0, -1)).toBeNull();
  });

  it('pula índices que falharam', () => {
    const failed = new Set([1]);
    expect(nextValidPhotoIndex(3, 0, 1, failed)).toBe(2);
    expect(nextValidPhotoIndex(3, 2, -1, failed)).toBe(0);
  });

  it('só falhas adiante → null (sem loop)', () => {
    expect(nextValidPhotoIndex(3, 0, 1, new Set([1, 2]))).toBeNull();
  });

  it('uma foto só → nunca há para onde ir', () => {
    expect(nextValidPhotoIndex(1, 0, 1)).toBeNull();
    expect(nextValidPhotoIndex(1, 0, -1)).toBeNull();
  });
});

describe('firstValidPhotoIndex', () => {
  it('mantém o índice atual quando ele é válido', () => {
    expect(firstValidPhotoIndex(3, 1, new Set())).toBe(1);
  });

  it('prefere a próxima; sem próxima, volta', () => {
    expect(firstValidPhotoIndex(3, 1, new Set([1]))).toBe(2);
    expect(firstValidPhotoIndex(3, 2, new Set([2]))).toBe(1);
    expect(firstValidPhotoIndex(3, 1, new Set([1, 2]))).toBe(0);
  });

  it('todas falharam ou lista vazia → null (fallback gradiente+inicial)', () => {
    expect(firstValidPhotoIndex(2, 0, new Set([0, 1]))).toBeNull();
    expect(firstValidPhotoIndex(0, 0, new Set())).toBeNull();
  });

  it('clampa índice fora da lista', () => {
    expect(firstValidPhotoIndex(2, 9, new Set())).toBe(1);
    expect(firstValidPhotoIndex(2, -3, new Set())).toBe(0);
  });
});

describe('getPhotoPrefetchUrls', () => {
  const p = (...urls: string[]) => ({
    photos: urls.map((url, slot) => ({ slot: slot as 0 | 1 | 2 | 3, url })),
  });
  const profiles = [p('a0', 'a1', 'a2'), p('b0', 'b1'), p()];

  it('próxima foto do atual + primeira do seguinte — só isso', () => {
    expect(getPhotoPrefetchUrls(profiles, 0, 0)).toEqual(['a1', 'b0']);
    expect(getPhotoPrefetchUrls(profiles, 0, 1)).toEqual(['a2', 'b0']);
  });

  it('na última foto do atual, só a primeira do seguinte', () => {
    expect(getPhotoPrefetchUrls(profiles, 0, 2)).toEqual(['b0']);
  });

  it('seguinte sem fotos ou inexistente → só a próxima do atual', () => {
    expect(getPhotoPrefetchUrls(profiles, 1, 0)).toEqual(['b1']);
    expect(getPhotoPrefetchUrls(profiles, 2, 0)).toEqual([]);
  });

  it('lista vazia → nada', () => {
    expect(getPhotoPrefetchUrls([], 0, 0)).toEqual([]);
  });
});

describe('describePhotoUrl', () => {
  it('corta a query string (é lá que vive a credencial assinada)', () => {
    expect(
      describePhotoUrl('https://cdn.example/u/abc/0.jpg?X-Goog-Signature=SECRET&Expires=1')
    ).toBe('https://cdn.example/u/abc/0.jpg');
  });

  it('sem query, devolve como está; vazio → marcador', () => {
    expect(describePhotoUrl('https://cdn.example/u/abc/0.jpg')).toBe(
      'https://cdn.example/u/abc/0.jpg'
    );
    expect(describePhotoUrl('')).toBe('(sem url)');
    expect(describePhotoUrl(undefined)).toBe('(sem url)');
  });
});
