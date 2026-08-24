import {
  MAX_EXPLORE_PHOTOS,
  effectivePrimarySlot,
  getSlotMeta,
  nextFreeSlot,
  normalizeMeta,
  orderedActiveSlots,
  removeSlot,
  upsertSlot,
} from '../explorePhotos';
import type { ExplorePhotoMeta, ExplorePhotoSlot } from '@models/user';

const m = (slot: ExplorePhotoSlot, active = true): ExplorePhotoMeta => ({ slot, active });
const badSlot = (n: number) => n as unknown as ExplorePhotoSlot;

describe('explorePhotos — nextFreeSlot', () => {
  it('0 fotos → 1', () => expect(nextFreeSlot([])).toBe(1));
  it('undefined → 1', () => expect(nextFreeSlot(undefined)).toBe(1));
  it('1 foto → 2', () => expect(nextFreeSlot([m(1)])).toBe(2));
  it('2 fotos → 3', () => expect(nextFreeSlot([m(1), m(2)])).toBe(3));
  it('3 fotos → null (cheia)', () => expect(nextFreeSlot([m(1), m(2), m(3)])).toBeNull());
  it('preenche buraco no meio', () => expect(nextFreeSlot([m(1), m(3)])).toBe(2));
});

describe('explorePhotos — upsertSlot', () => {
  it('insere ordenado e sem duplicar', () => {
    expect(upsertSlot([m(3)], 1, true)).toEqual([m(1), m(3)]);
    expect(upsertSlot([m(1), m(3)], 3, false)).toEqual([m(1), m(3, false)]);
  });

  it('atualizar slot existente com galeria cheia é permitido', () => {
    expect(upsertSlot([m(1), m(2), m(3)], 2, false)).toEqual([m(1), m(2, false), m(3)]);
  });

  it('recusa a 4ª foto', () => {
    expect(() => upsertSlot([m(1), m(2), m(3)], badSlot(4), true)).toThrow(RangeError);
    // Metadata suja com 3 slots válidos + lixo continua "cheia".
    const dirtyFull = [m(1), m(2), m(3), { slot: 7, active: true } as unknown as ExplorePhotoMeta];
    expect(nextFreeSlot(dirtyFull)).toBeNull();
  });

  it('recusa slot fora de 1..3', () => {
    expect(() => upsertSlot([], badSlot(0), true)).toThrow(RangeError);
    expect(() => upsertSlot([], badSlot(4), true)).toThrow(RangeError);
  });

  it('nunca passa de MAX_EXPLORE_PHOTOS mesmo com metadata suja', () => {
    const dirty = [m(1), m(1), m(2), m(3), { slot: 9, active: true } as unknown as ExplorePhotoMeta];
    expect(normalizeMeta(dirty)).toEqual([m(1), m(2), m(3)]);
    expect(normalizeMeta(dirty)).toHaveLength(MAX_EXPLORE_PHOTOS);
  });

  it('slots duplicados: o último vence', () => {
    expect(normalizeMeta([m(2, true), m(2, false)])).toEqual([m(2, false)]);
  });
});

describe('explorePhotos — removeSlot', () => {
  it('remove e é idempotente', () => {
    expect(removeSlot([m(1), m(2)], 1)).toEqual([m(2)]);
    expect(removeSlot([m(2)], 1)).toEqual([m(2)]);
    expect(removeSlot(undefined, 1)).toEqual([]);
  });

  it('getSlotMeta devolve null para slot ausente', () => {
    expect(getSlotMeta([m(1)], 2)).toBeNull();
    expect(getSlotMeta([m(1)], 1)).toEqual(m(1));
  });
});

describe('explorePhotos — orderedActiveSlots / effectivePrimarySlot', () => {
  it('principal ativa vem primeiro', () => {
    expect(orderedActiveSlots([m(1), m(2), m(3)], 3)).toEqual([3, 1, 2]);
    expect(effectivePrimarySlot([m(1), m(2), m(3)], 3)).toBe(3);
  });

  it('principal inativa → primeira ativa assume', () => {
    expect(orderedActiveSlots([m(1), m(2, false), m(3)], 2)).toEqual([1, 3]);
    expect(effectivePrimarySlot([m(1), m(2, false), m(3)], 2)).toBe(1);
  });

  it('principal removida → primeira ativa assume', () => {
    expect(orderedActiveSlots([m(2), m(3)], 1)).toEqual([2, 3]);
  });

  it('sem principal definida → ordem crescente das ativas', () => {
    expect(orderedActiveSlots([m(1, false), m(2), m(3)], undefined)).toEqual([2, 3]);
  });

  it('nenhuma ativa → vazio / null', () => {
    expect(orderedActiveSlots([m(1, false)], 1)).toEqual([]);
    expect(effectivePrimarySlot([], null)).toBeNull();
  });
});
