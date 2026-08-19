/**
 * profilePhotoService — foto de perfil enviada NO Meu Best (Firebase Storage).
 *
 * Modelo de dados (ver também `@shared/utils/profilePhoto`):
 *
 *   Storage : `users/{uid}/profile/avatar.jpg` — path ESTÁVEL. Trocar a foto
 *             sobrescreve o mesmo arquivo (nunca avatar-1/2/3): zero lixo
 *             acumulado e as Rules ficam triviais.
 *   Firestore: `profilePhotoPath` + `profilePhotoURL` no doc do usuário.
 *             O doc só é atualizado DEPOIS do upload dar certo — nunca fica
 *             apontando para um arquivo que não existe.
 *
 * O `photoURL` legado do provider (Google/Apple) é INTOCADO por este serviço.
 *
 * ⚠️ Blocker externo conhecido: o bucket do projeto ainda não existe (Cloud
 * Storage for Firebase pendente de habilitação no Console). Até lá, o upload
 * falha — e falha GRACIOSO: `ProfilePhotoError` com mensagem amigável, sem
 * nenhum write no Firestore.
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

/** Maior lado após o redimensionamento — suficiente para qualquer avatar. */
const MAX_DIMENSION = 1440;
/** Compressão JPEG — bom equilíbrio qualidade × tamanho para foto de rosto. */
const JPEG_QUALITY = 0.8;

export const UPLOAD_ERROR_MESSAGE =
  'Não foi possível enviar a foto agora. Tente novamente mais tarde.';
export const REMOVE_ERROR_MESSAGE =
  'Não foi possível remover a foto agora. Tente novamente mais tarde.';

/**
 * Erro tipado do serviço: `message` é SEMPRE seguro para exibir num Alert.
 * O erro original fica em `cause` para log — nunca para a UI.
 */
export class ProfilePhotoError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ProfilePhotoError';
  }
}

export type PickProfileImageResult =
  | { status: 'success'; uri: string; width?: number; height?: number }
  /** Usuário fechou o seletor — não é erro, a UI não mostra nada. */
  | { status: 'canceled' }
  /** Permissão de galeria negada — a UI orienta a habilitar nos ajustes. */
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * Abre a galeria para escolher a foto (recorte quadrado, imagens apenas).
 * Nunca lança: todo desfecho vira um resultado tipado.
 */
export async function pickProfileImage(): Promise<PickProfileImageResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      // quality 1 aqui de propósito: a compressão acontece UMA vez só, no
      // `processProfileImage` — comprimir duas vezes degrada à toa.
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return { status: 'canceled' };
    }

    const asset = result.assets[0];
    return { status: 'success', uri: asset.uri, width: asset.width, height: asset.height };
  } catch (error) {
    console.error('[profilePhoto] Falha ao abrir a galeria:', error);
    return { status: 'error', message: 'Não foi possível abrir a galeria. Tente novamente.' };
  }
}

/**
 * Redimensiona (máx. 1440px no maior lado, preservando proporção) e re-encoda
 * como JPEG a ~0.8. O re-encode também normaliza a orientação EXIF — fotos de
 * câmera deixam de aparecer deitadas.
 *
 * `size` vem do asset do picker; sem ele, só re-encoda (não arriscamos ampliar
 * uma imagem pequena por chutar dimensão).
 */
export async function processProfileImage(
  uri: string,
  size?: { width?: number; height?: number }
): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);

    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      // Limita só o MAIOR lado; o outro é calculado para preservar a proporção.
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
    console.error('[profilePhoto] Falha ao processar imagem:', error);
    throw new ProfilePhotoError(UPLOAD_ERROR_MESSAGE, error);
  }
}

/** Path estável no Storage — substituição sobrescreve o mesmo arquivo. */
export function buildProfilePhotoPath(uid: string): string {
  return `users/${uid}/profile/avatar.jpg`;
}

/**
 * Sobe a foto processada e SÓ ENTÃO grava a referência no doc do usuário.
 * Falha em qualquer etapa → `ProfilePhotoError` e doc intacto — nunca fica
 * uma referência quebrada no Firestore.
 */
export async function uploadProfilePhoto(
  uid: string,
  processedUri: string
): Promise<{ path: string; url: string }> {
  const path = buildProfilePhotoPath(uid);
  try {
    const response = await fetch(processedUri);
    const blob = await response.blob();

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(storageRef);

    // Última etapa de propósito: se qualquer coisa acima falhar, o doc não
    // aponta para arquivo inexistente.
    await updateDoc(doc(db, 'users', uid), {
      profilePhotoPath: path,
      profilePhotoURL: url,
    });

    return { path, url };
  } catch (error) {
    console.error('[profilePhoto] Falha no upload:', error);
    throw new ProfilePhotoError(UPLOAD_ERROR_MESSAGE, error);
  }
}

/**
 * Remove o arquivo do Storage e limpa a referência no doc.
 *
 * Estratégia: NUNCA apagar a referência sem o arquivo ter sido tratado.
 * `storage/object-not-found` conta como tratado (o arquivo já não existe —
 * referência órfã, limpar é o conserto). Qualquer outro erro propaga e a
 * referência FICA: melhor uma foto que insiste em aparecer do que um arquivo
 * órfão impossível de rastrear.
 */
export async function removeProfilePhoto(uid: string, currentPath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, currentPath));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== 'storage/object-not-found') {
      console.error('[profilePhoto] Falha ao remover do Storage:', error);
      throw new ProfilePhotoError(REMOVE_ERROR_MESSAGE, error);
    }
    // Arquivo já não existe: segue para limpar a referência órfã.
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      profilePhotoPath: deleteField(),
      profilePhotoURL: deleteField(),
    });
  } catch (error) {
    console.error('[profilePhoto] Falha ao limpar referência:', error);
    throw new ProfilePhotoError(REMOVE_ERROR_MESSAGE, error);
  }
}
