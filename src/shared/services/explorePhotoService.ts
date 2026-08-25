/**
 * explorePhotoService — galeria do Explorar (até 3 fotos, Firebase Storage).
 *
 * Modelo de dados (regras puras em `@shared/utils/explorePhotos`):
 *
 *   Storage : `users/{uid}/explore/photo-{slot}.jpg` — path DERIVADO do slot.
 *             Trocar a foto de um slot sobrescreve o mesmo arquivo.
 *   Firestore: `explorePhotos: [{ slot, active }]` + `explorePrimaryPhotoSlot`.
 *             Só metadata — nenhum path, nenhuma URL, nenhum base64.
 *             O doc só é atualizado DEPOIS do upload dar certo.
 *
 * Quem lê:
 *   - O DONO lê as próprias fotos via `getDownloadURL` autenticado (Rules
 *     permitem owner) — `getExplorePhotoUrl`.
 *   - TERCEIROS recebem as URLs pela API, que aplica `showPhotoInExplore`.
 *
 * Erros: `ExplorePhotoError.message` é sempre seguro para Alert.
 */
import * as ImagePicker from 'expo-image-picker';
// expo-image-manipulator importado DINAMICAMENTE (módulo nativo novo — ver
// nota em profilePhotoService): só o fluxo de foto degrada em client antigo.
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { ExplorePhotoMeta, ExplorePhotoSlot } from '@models/user';
import {
  MAX_EXPLORE_PHOTOS,
  getSlotMeta,
  isExplorePhotoSlot,
  removeSlot,
  upsertSlot,
} from '@shared/utils/explorePhotos';
import { db, storage } from './firebase';

/** Maior lado após o redimensionamento. */
const MAX_DIMENSION = 1440;
const JPEG_QUALITY = 0.8;

export const EXPLORE_UPLOAD_ERROR_MESSAGE =
  'Não foi possível enviar a foto agora. Tente novamente mais tarde.';
export const EXPLORE_REMOVE_ERROR_MESSAGE =
  'Não foi possível remover a foto agora. Tente novamente mais tarde.';
export const EXPLORE_UPDATE_ERROR_MESSAGE =
  'Não foi possível atualizar a foto agora. Tente novamente mais tarde.';
export const EXPLORE_LIMIT_ERROR_MESSAGE = `Você pode ter no máximo ${MAX_EXPLORE_PHOTOS} fotos no Explorar.`;
export const EXPLORE_INVALID_SLOT_MESSAGE = 'Posição de foto inválida.';

export class ExplorePhotoError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ExplorePhotoError';
  }
}

export type PickExploreImageResult =
  | { status: 'success'; uri: string; width?: number; height?: number }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * Abre a galeria com recorte VERTICAL 9:16 — o card do Explorar tem proporção
 * ≈0,59 (largura/altura), então a foto já nasce no formato certo.
 * Nunca lança: todo desfecho vira resultado tipado.
 */
export async function pickExploreImage(): Promise<PickExploreImageResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      // Compressão acontece UMA vez, em processExploreImage.
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return { status: 'canceled' };
    }

    const asset = result.assets[0];
    return { status: 'success', uri: asset.uri, width: asset.width, height: asset.height };
  } catch (error) {
    console.error('[explorePhoto] Falha ao abrir a galeria:', error);
    return { status: 'error', message: 'Não foi possível abrir a galeria. Tente novamente.' };
  }
}

/**
 * Redimensiona (maior lado ≤ 1440, proporção preservada) e re-encoda JPEG 0.8.
 * Sem `size` só re-encoda — nunca amplia uma imagem pequena por chute.
 */
export async function processExploreImage(
  uri: string,
  size?: { width?: number; height?: number }
): Promise<string> {
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
    const context = ImageManipulator.manipulate(uri);

    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width >= height) {
        context.resize({ width: MAX_DIMENSION });
      } else {
        context.resize({ height: MAX_DIMENSION });
      }
    }

    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return result.uri;
  } catch (error) {
    console.error('[explorePhoto] Falha ao processar imagem:', error);
    throw new ExplorePhotoError(EXPLORE_UPLOAD_ERROR_MESSAGE, error);
  }
}

/** Path derivado — nunca gravado no Firestore. */
export function explorePhotoPath(uid: string, slot: ExplorePhotoSlot): string {
  return `users/${uid}/explore/photo-${slot}.jpg`;
}

function assertSlot(slot: unknown): asserts slot is ExplorePhotoSlot {
  if (!isExplorePhotoSlot(slot)) {
    throw new ExplorePhotoError(EXPLORE_INVALID_SLOT_MESSAGE);
  }
}

/**
 * downloadURL da PRÓPRIA foto (leitura autenticada do owner). Terceiros não
 * passam por aqui — recebem URLs pela API.
 */
export async function getExplorePhotoUrl(uid: string, slot: ExplorePhotoSlot): Promise<string> {
  return getDownloadURL(ref(storage, explorePhotoPath(uid, slot)));
}

/**
 * Sobe a foto no slot e SÓ ENTÃO grava a metadata. Recusa slot fora de 1..3
 * e a 4ª foto (slot novo com galeria cheia). Um slot já ocupado é
 * sobrescrito (TROCAR) e volta a `active: true`.
 */
export async function uploadExplorePhoto(
  uid: string,
  slot: ExplorePhotoSlot,
  processedUri: string,
  currentMeta: ExplorePhotoMeta[] | null | undefined
): Promise<{ path: string; explorePhotos: ExplorePhotoMeta[] }> {
  assertSlot(slot);

  // Valida o limite ANTES do upload — não vale gastar rede para recusar depois.
  let nextMeta: ExplorePhotoMeta[];
  try {
    nextMeta = upsertSlot(currentMeta, slot, true);
  } catch (error) {
    throw new ExplorePhotoError(EXPLORE_LIMIT_ERROR_MESSAGE, error);
  }

  const path = explorePhotoPath(uid, slot);
  try {
    const response = await fetch(processedUri);
    const blob = await response.blob();
    await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });

    // Última etapa de propósito: metadata só aponta para arquivo que existe.
    await updateDoc(doc(db, 'users', uid), { explorePhotos: nextMeta });
    return { path, explorePhotos: nextMeta };
  } catch (error) {
    console.error('[explorePhoto] Falha no upload:', error);
    throw new ExplorePhotoError(EXPLORE_UPLOAD_ERROR_MESSAGE, error);
  }
}

/** Liga/desliga a visibilidade de um slot existente (1 write). */
export async function setExplorePhotoActive(
  uid: string,
  slot: ExplorePhotoSlot,
  active: boolean,
  currentMeta: ExplorePhotoMeta[] | null | undefined
): Promise<ExplorePhotoMeta[]> {
  assertSlot(slot);
  if (!getSlotMeta(currentMeta, slot)) {
    throw new ExplorePhotoError(EXPLORE_INVALID_SLOT_MESSAGE);
  }
  const nextMeta = upsertSlot(currentMeta, slot, active);
  try {
    await updateDoc(doc(db, 'users', uid), { explorePhotos: nextMeta });
    return nextMeta;
  } catch (error) {
    console.error('[explorePhoto] Falha ao atualizar visibilidade:', error);
    throw new ExplorePhotoError(EXPLORE_UPDATE_ERROR_MESSAGE, error);
  }
}

/**
 * Define a principal — só atualiza `explorePrimaryPhotoSlot`, nenhum arquivo
 * se move. Exige slot existente e ATIVO.
 */
export async function setExplorePrimaryPhoto(
  uid: string,
  slot: ExplorePhotoSlot,
  currentMeta: ExplorePhotoMeta[] | null | undefined
): Promise<void> {
  assertSlot(slot);
  const meta = getSlotMeta(currentMeta, slot);
  if (!meta || !meta.active) {
    throw new ExplorePhotoError('Só uma foto ativa pode ser a principal.');
  }
  try {
    await updateDoc(doc(db, 'users', uid), { explorePrimaryPhotoSlot: slot });
  } catch (error) {
    console.error('[explorePhoto] Falha ao definir principal:', error);
    throw new ExplorePhotoError(EXPLORE_UPDATE_ERROR_MESSAGE, error);
  }
}

/**
 * Remove o arquivo (object-not-found tolerado: referência órfã, limpar é o
 * conserto) e depois a metadata. Se era a principal, apaga o ponteiro — a
 * primeira ativa assume na leitura (`orderedActiveSlots`).
 */
export async function removeExplorePhoto(
  uid: string,
  slot: ExplorePhotoSlot,
  currentMeta: ExplorePhotoMeta[] | null | undefined,
  currentPrimary?: ExplorePhotoSlot | null
): Promise<ExplorePhotoMeta[]> {
  assertSlot(slot);

  try {
    await deleteObject(ref(storage, explorePhotoPath(uid, slot)));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== 'storage/object-not-found') {
      console.error('[explorePhoto] Falha ao remover do Storage:', error);
      throw new ExplorePhotoError(EXPLORE_REMOVE_ERROR_MESSAGE, error);
    }
  }

  const nextMeta = removeSlot(currentMeta, slot);
  try {
    await updateDoc(doc(db, 'users', uid), {
      explorePhotos: nextMeta,
      ...(currentPrimary === slot ? { explorePrimaryPhotoSlot: deleteField() } : {}),
    });
    return nextMeta;
  } catch (error) {
    console.error('[explorePhoto] Falha ao limpar metadata:', error);
    throw new ExplorePhotoError(EXPLORE_REMOVE_ERROR_MESSAGE, error);
  }
}
