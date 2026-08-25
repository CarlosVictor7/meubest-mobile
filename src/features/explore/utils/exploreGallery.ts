/**
 * exploreGallery — regras PURAS da galeria de fotos do card do Explorar.
 *
 *   - qual zona de toque foi tocada (40% esquerda / 40% direita / centro)
 *   - para qual índice ir, pulando fotos que falharam, SEM wrap
 *   - o que prefetchar (próxima foto do perfil atual + 1ª do perfil seguinte)
 *   - como descrever uma URL assinada em log sem vazar a credencial
 */
import type { ExplorePhoto, PublicExploreProfile } from '../types';

export type GalleryTapZone = 'prev' | 'next' | 'none';

/** Fração da largura, em cada borda, que navega a galeria. */
export const GALLERY_TAP_ZONE_RATIO = 0.4;

/** Zona de toque a partir do X do toque e da largura do card. */
export function getGalleryTapZone(x: number, width: number): GalleryTapZone {
  if (!(width > 0) || !Number.isFinite(x)) return 'none';
  if (x < 0 || x > width) return 'none';
  if (x < width * GALLERY_TAP_ZONE_RATIO) return 'prev';
  if (x > width * (1 - GALLERY_TAP_ZONE_RATIO)) return 'next';
  return 'none';
}

/**
 * Próximo índice válido a partir de `from`, na direção `dir`, pulando os
 * índices em `failed`. Sem wrap: devolve `null` quando não há para onde ir
 * (primeira/última foto, ou só falhas adiante).
 */
export function nextValidPhotoIndex(
  count: number,
  from: number,
  dir: 1 | -1,
  failed: ReadonlySet<number> = new Set()
): number | null {
  for (let i = from + dir; i >= 0 && i < count; i += dir) {
    if (!failed.has(i)) return i;
  }
  return null;
}

/**
 * Primeiro índice válido a partir de `from` (inclusive) indo para a frente;
 * se nada adiante, tenta para trás. `null` quando todas falharam — o card
 * cai no fallback gradiente+inicial.
 */
export function firstValidPhotoIndex(
  count: number,
  from: number,
  failed: ReadonlySet<number>
): number | null {
  if (count <= 0) return null;
  const start = Math.min(Math.max(from, 0), count - 1);
  if (!failed.has(start)) return start;
  return (
    nextValidPhotoIndex(count, start, 1, failed) ??
    nextValidPhotoIndex(count, start, -1, failed)
  );
}

/**
 * URLs a prefetchar quando o perfil `index` está visível mostrando a foto
 * `photoIndex`: a próxima foto dele e a primeira do perfil seguinte. Só isso —
 * cada foto é uma URL assinada distinta e o cache em disco já segura o resto.
 */
export function getPhotoPrefetchUrls(
  profiles: ReadonlyArray<Pick<PublicExploreProfile, 'photos'>>,
  index: number,
  photoIndex: number
): string[] {
  const urls: string[] = [];
  const current = profiles[index];
  const nextPhoto: ExplorePhoto | undefined = current?.photos[photoIndex + 1];
  if (nextPhoto?.url) urls.push(nextPhoto.url);
  const following = profiles[index + 1]?.photos[0];
  if (following?.url && !urls.includes(following.url)) urls.push(following.url);
  return urls;
}

/**
 * Descrição segura de uma URL assinada para logs: só origem + caminho, nunca
 * a query string (é lá que vive a credencial de 1 h).
 */
export function describePhotoUrl(url: string | null | undefined): string {
  if (typeof url !== 'string' || !url) return '(sem url)';
  const cut = url.indexOf('?');
  return cut === -1 ? url : url.slice(0, cut);
}
