/**
 * explorePhotos — regras PURAS da galeria do Explorar (≤ 3 fotos).
 *
 * O Firestore guarda só metadata (`explorePhotos: [{ slot, active }]` e
 * `explorePrimaryPhotoSlot`). O path do arquivo é derivado do slot pelo
 * serviço — aqui não existe Storage, Firestore nem React: só arrays.
 *
 * Invariantes garantidas por `normalizeMeta`:
 *   - slots únicos (último vence), só 1..3, ordenados crescente, ≤ 3 itens.
 */
import type { ExplorePhotoMeta, ExplorePhotoSlot } from '@models/user';

export const MAX_EXPLORE_PHOTOS = 3;
export const EXPLORE_PHOTO_SLOTS: readonly ExplorePhotoSlot[] = [1, 2, 3];

export function isExplorePhotoSlot(value: unknown): value is ExplorePhotoSlot {
  return value === 1 || value === 2 || value === 3;
}

/** Sanitiza metadata vinda do Firestore (pode estar ausente/suja). */
export function normalizeMeta(meta: ExplorePhotoMeta[] | null | undefined): ExplorePhotoMeta[] {
  const bySlot = new Map<ExplorePhotoSlot, ExplorePhotoMeta>();
  for (const item of Array.isArray(meta) ? meta : []) {
    if (!item || !isExplorePhotoSlot(item.slot)) continue;
    bySlot.set(item.slot, { slot: item.slot, active: item.active !== false });
  }
  return EXPLORE_PHOTO_SLOTS.filter((s) => bySlot.has(s))
    .map((s) => bySlot.get(s) as ExplorePhotoMeta)
    .slice(0, MAX_EXPLORE_PHOTOS);
}

/** Primeiro slot sem foto, ou `null` quando a galeria está cheia. */
export function nextFreeSlot(meta: ExplorePhotoMeta[] | null | undefined): ExplorePhotoSlot | null {
  const used = new Set(normalizeMeta(meta).map((m) => m.slot));
  return EXPLORE_PHOTO_SLOTS.find((s) => !used.has(s)) ?? null;
}

export function getSlotMeta(
  meta: ExplorePhotoMeta[] | null | undefined,
  slot: ExplorePhotoSlot
): ExplorePhotoMeta | null {
  return normalizeMeta(meta).find((m) => m.slot === slot) ?? null;
}

/**
 * Insere ou atualiza o slot. Lança quando o slot é inválido ou quando o
 * resultado passaria de 3 fotos (a 4ª é recusada — nunca sobrescreve outra).
 */
export function upsertSlot(
  meta: ExplorePhotoMeta[] | null | undefined,
  slot: ExplorePhotoSlot,
  active: boolean
): ExplorePhotoMeta[] {
  if (!isExplorePhotoSlot(slot)) {
    throw new RangeError(`Slot inválido: ${String(slot)}`);
  }
  const current = normalizeMeta(meta);
  const exists = current.some((m) => m.slot === slot);
  if (!exists && current.length >= MAX_EXPLORE_PHOTOS) {
    throw new RangeError(`Limite de ${MAX_EXPLORE_PHOTOS} fotos atingido`);
  }
  return normalizeMeta([...current.filter((m) => m.slot !== slot), { slot, active }]);
}

/** Remove o slot (idempotente: remover o que não existe devolve o mesmo conteúdo). */
export function removeSlot(
  meta: ExplorePhotoMeta[] | null | undefined,
  slot: ExplorePhotoSlot
): ExplorePhotoMeta[] {
  return normalizeMeta(meta).filter((m) => m.slot !== slot);
}

/**
 * Slots ATIVOS na ordem de exibição: a principal primeiro (se existir e estiver
 * ativa), depois as demais em ordem crescente. Principal inativa/removida →
 * a primeira ativa assume, sem write nenhum.
 */
export function orderedActiveSlots(
  meta: ExplorePhotoMeta[] | null | undefined,
  primary: ExplorePhotoSlot | null | undefined
): ExplorePhotoSlot[] {
  const active = normalizeMeta(meta)
    .filter((m) => m.active)
    .map((m) => m.slot);
  if (primary != null && active.includes(primary)) {
    return [primary, ...active.filter((s) => s !== primary)];
  }
  return active;
}

/** Slot que está fazendo papel de principal agora (ou `null` sem fotos ativas). */
export function effectivePrimarySlot(
  meta: ExplorePhotoMeta[] | null | undefined,
  primary: ExplorePhotoSlot | null | undefined
): ExplorePhotoSlot | null {
  return orderedActiveSlots(meta, primary)[0] ?? null;
}
