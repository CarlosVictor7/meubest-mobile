/**
 * appleAuth.ts — Apple Sign-In service (iOS apenas)
 *
 * iOS (nativo):
 *   Usa expo-apple-authentication para autenticação nativa com sheet da Apple.
 *   Requer iOS 13+ em dispositivo físico ou simulador compatível.
 *
 * Android:
 *   NÃO IMPLEMENTADO nesta versão.
 *   Motivo técnico: signInWithPopup() do Firebase Web SDK depende de window.open()
 *   e postMessage(), que não existem em React Native. Tentativas de uso resultam em
 *   "auth/operation-not-supported-in-this-environment".
 *   Alternativa futura (Fase 2): AuthSession + expo-web-browser com deep link callback
 *   configurado via scheme URI. Requer testes extensivos em dispositivo real.
 *   Por enquanto, o botão Apple é OCULTADO no Android — não quebra o Google login.
 *
 * Regras de upsert:
 *   - Nunca sobrescreve name, email, role, isProfileComplete com null/undefined.
 *   - A Apple só fornece nome no PRIMEIRO login — armazena somente se vier.
 *   - E-mail privaterelay.appleid.com → salvo em applePrivateEmail, não em email.
 *   - Não realiza merge automático com contas Google existentes.
 */

import { Platform } from 'react-native';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '@models/user';

// ─── Tipos ──────────────────────────────────────────────────────────
export type AppleSignInResult =
  | { type: 'success'; uid: string; isNewUser: boolean }
  | { type: 'cancelled' }
  | { type: 'notAvailable' }   // iOS < 13, simulador sem suporte, ou Android
  | { type: 'error'; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────

/** Gera um nonce seguro de 32 bytes codificado em hex. */
async function generateNonce(): Promise<string> {
  const { getRandomBytes } = await import('expo-crypto');
  const bytes = getRandomBytes(32);
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Calcula SHA-256 de uma string e retorna hex. */
async function sha256(value: string): Promise<string> {
  const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, value);
}

/** Detecta se o e-mail é um relay privado da Apple. */
function isApplePrivateEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith('@privaterelay.appleid.com');
}

/**
 * Faz upsert do perfil no Firestore de forma segura:
 * - Cria perfil mínimo para usuário novo.
 * - Para existente: atualiza só campos recebidos e não-nulos.
 * - Nunca sobrescreve dados existentes com undefined/null.
 */
async function upsertAppleProfile(params: {
  uid: string;
  displayName: string | null;
  email: string | null;
  providerIds: string[];
  role: 'speaker' | 'listener';
}): Promise<boolean> {
  const { uid, displayName, email, providerIds, role } = params;

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const isNewUser = !userSnap.exists();

  if (isNewUser) {
    // Perfil mínimo para novo usuário Apple
    const profile: Partial<UserProfile> = {
      uid,
      role,
      authProvider: 'apple',
      providerIds,
      isOnline: role === 'listener',
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      isProfileComplete: false,
      points: 0,
      level: 1,
      gratitudeCoins: 0,
      balance: 0,
      totalEarnings: 0,
      currentStreak: 0,
      badges: [],
      rating: 5.0,
      showTutorial: true,
    };

    // Nome: Apple só envia no primeiro login — salva somente se vier
    profile.name = displayName || 'Usuário';

    // E-mail: trata relay privado
    if (email) {
      if (isApplePrivateEmail(email)) {
        profile.email = '';
        profile.applePrivateEmail = email;
      } else {
        profile.email = email;
      }
    } else {
      profile.email = '';
    }

    await setDoc(userRef, profile);
  } else {
    // Usuário existente: atualiza apenas providerIds e applePrivateEmail (se relay)
    // NÃO sobrescreve name, email, role, isProfileComplete
    const updates: Record<string, any> = {
      providerIds,
      updatedAt: serverTimestamp(),
    };

    // Salva e-mail de relay privado se disponível e ainda não salvo
    if (email && isApplePrivateEmail(email)) {
      const existingData = userSnap.data() as UserProfile;
      if (!existingData.applePrivateEmail) {
        updates.applePrivateEmail = email;
      }
    }

    // Nome: só atualiza se vier da Apple E o perfil não tiver nome real ainda
    if (displayName) {
      const existingData = userSnap.data() as UserProfile;
      if (!existingData.name || existingData.name === 'Usuário') {
        updates.name = displayName;
      }
    }

    await setDoc(userRef, updates, { merge: true });
  }

  return isNewUser;
}

// ─── iOS — Apple Sign-In nativo ──────────────────────────────────────

async function signInWithAppleIOS(
  role: 'speaker' | 'listener'
): Promise<AppleSignInResult> {
  // Import dinâmico — expo-apple-authentication não deve ser importado no Android
  let AppleAuthentication: typeof import('expo-apple-authentication');
  try {
    AppleAuthentication = await import('expo-apple-authentication');
  } catch {
    return { type: 'notAvailable' };
  }

  // Verifica disponibilidade (requer iOS 13+ em dispositivo físico/simulador compatível)
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    return { type: 'notAvailable' };
  }

  try {
    // Gera nonce para vincular credencial Apple ↔ Firebase com segurança
    const rawNonce = await generateNonce();
    const hashedNonce = await sha256(rawNonce);

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { type: 'error', message: 'Apple não retornou identityToken.' };
    }

    // Monta credencial Firebase com o nonce original (não hasheado)
    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken,
      rawNonce,
    });

    const userCredential = await signInWithCredential(auth, firebaseCredential);
    const { uid } = userCredential.user;

    // Apple fornece fullName apenas no PRIMEIRO login
    const givenName = credential.fullName?.givenName ?? null;
    const familyName = credential.fullName?.familyName ?? null;
    const displayName =
      givenName || familyName
        ? [givenName, familyName].filter(Boolean).join(' ')
        : null;

    const providerIds = userCredential.user.providerData.map((p) => p.providerId);

    const isNewUser = await upsertAppleProfile({
      uid,
      displayName,
      email: credential.email ?? userCredential.user.email,
      providerIds,
      role,
    });

    return { type: 'success', uid, isNewUser };
  } catch (error: any) {
    if (
      error.code === 'ERR_REQUEST_CANCELED' ||
      error.code === 'com.apple.AuthenticationServices.AuthorizationError.1001'
    ) {
      return { type: 'cancelled' };
    }
    console.error('[appleAuth] iOS signInWithApple error:', error);
    return {
      type: 'error',
      message: error?.message ?? 'Erro ao autenticar com a Apple.',
    };
  }
}

// ─── Ponto de entrada público ─────────────────────────────────────────

/**
 * Inicia o fluxo de Apple Sign-In na plataforma atual.
 *
 * - iOS: usa expo-apple-authentication (nativo, sheet da Apple). ✅ Suportado.
 * - Android: retorna { type: 'notAvailable' }. O botão é ocultado na UI.
 *   Razão: signInWithPopup() e signInWithRedirect() do Firebase Web SDK não
 *   funcionam em React Native — dependem de window.open() e postMessage()
 *   que não existem no ambiente nativo.
 *   Fase 2: implementar via AuthSession + deep link.
 * - Web: não chama esta função — usa OAuthProvider direto na LandingPage.
 *
 * @param role - papel padrão para novos usuários ('speaker' | 'listener')
 */
export async function signInWithApple(
  role: 'speaker' | 'listener' = 'speaker'
): Promise<AppleSignInResult> {
  if (Platform.OS === 'ios') {
    return signInWithAppleIOS(role);
  }

  // Android e qualquer outra plataforma não suportada nesta versão
  // O botão Apple é ocultado no Android via Platform.OS check na UI
  return { type: 'notAvailable' };
}

/**
 * Indica se Apple Sign-In está disponível na plataforma atual.
 * Use isso na UI para decidir se o botão Apple deve ser exibido.
 *
 * - iOS: true (o fluxo nativo está disponível)
 * - Android: false (não implementado nesta versão — Fase 2)
 * - Web: N/A (web usa fluxo próprio na LandingPage)
 */
export function isAppleSignInSupported(): boolean {
  return Platform.OS === 'ios';
}
