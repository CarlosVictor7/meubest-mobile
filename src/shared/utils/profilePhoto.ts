/**
 * profilePhoto — decisão PURA de qual foto exibir para um perfil.
 *
 * Modelo de dados (decidido na Parte 1 do ciclo de foto):
 *
 *   profilePhotoURL → foto enviada NO Meu Best (downloadURL do Storage)
 *   photoURL        → foto legada do provider (Google/Apple) — fica INTOCADA
 *
 * Prioridade: profilePhotoURL → photoURL → null (a UI cai para a inicial).
 * String vazia ou só espaços conta como ausente: um campo que sobrou vazio no
 * banco nunca pode "vencer" a foto do provider nem quebrar o <Image>.
 */

/** Aceita qualquer objeto com os campos de foto — inclusive docs crus do Firestore. */
export interface ProfilePhotoSource {
  profilePhotoURL?: string | null;
  photoURL?: string | null;
}

export function getDisplayPhotoUrl(
  profile: ProfilePhotoSource | null | undefined
): string | null {
  const own = profile?.profilePhotoURL?.trim();
  if (own) return own;
  const legacy = profile?.photoURL?.trim();
  if (legacy) return legacy;
  return null;
}
