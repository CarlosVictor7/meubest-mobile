/**
 * googleAuth.ts — Google Sign-In service
 *
 * Encapsula o fluxo de autenticação Google para o Meu Best Mobile.
 *
 * IMPORTANTE:
 * - No Expo Go: sempre retorna `expoGoLimitation` (Google OAuth
 *   requer custom scheme nativo, não suportado no Expo Go).
 * - No Development Build (EAS): funciona completamente com
 *   expo-auth-session + GoogleAuthProvider do Firebase.
 *
 * Refs:
 * - https://docs.expo.dev/guides/google-authentication/
 * - https://firebase.google.com/docs/auth/web/google-signin
 */
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri, type AuthSessionResult } from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import { appConfig } from '@constants/appConfig';
import type { UserProfile } from '@models/user';

// Necessário para fechar o browser corretamente ao retornar
WebBrowser.maybeCompleteAuthSession();

// ─── Tipos ─────────────────────────────────────────────────────────
export type GoogleSignInResult =
  | { type: 'success'; uid: string; isNewUser: boolean }
  | { type: 'cancelled' }
  | { type: 'expoGoLimitation' }
  | { type: 'error'; message: string };

// ─── Detecta se está rodando no Expo Go ────────────────────────────
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// ─── Hook de sign-in Google ────────────────────────────────────────
/**
 * Retorna `[request, response, promptAsync]` e a função `handleGoogleSignIn`.
 *
 * Uso:
 * ```tsx
 * const { handleGoogleSignIn, isLoading } = useGoogleSignIn({ role });
 * ```
 */
export function buildGoogleAuthRequest() {
  return Google.useAuthRequest({
    clientId: appConfig.googleWebClientId,
    iosClientId: appConfig.googleIosClientId,
    redirectUri: makeRedirectUri({ scheme: 'meubest' }),
    scopes: ['openid', 'profile', 'email'],
  });
}

/**
 * Processa a resposta do Google OAuth e cria/atualiza o perfil no Firestore.
 *
 * @param response - resposta do `useAuthRequest` prompt
 * @param role - papel selecionado na RoleSelectionScreen
 */
export async function handleGoogleResponse(
  response: AuthSessionResult | null,
  role: 'speaker' | 'listener' = 'speaker'
): Promise<GoogleSignInResult> {
  if (isExpoGo()) {
    return { type: 'expoGoLimitation' };
  }

  if (!response) return { type: 'cancelled' };

  if (response.type === 'cancel' || response.type === 'dismiss') {
    return { type: 'cancelled' };
  }

  if (response.type !== 'success') {
    return { type: 'error', message: 'Autenticação não foi completada.' };
  }

  const { id_token } = response.params;
  if (!id_token) {
    return { type: 'error', message: 'Token de autenticação inválido.' };
  }

  try {
    const credential = GoogleAuthProvider.credential(id_token);
    const userCredential = await signInWithCredential(auth, credential);
    const { uid, displayName, email, photoURL } = userCredential.user;

    // Upsert do perfil no Firestore
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const isNewUser = !userSnap.exists();

    if (isNewUser) {
      const profile: Partial<UserProfile> = {
        uid,
        name: displayName ?? 'Usuário',
        email: email ?? '',
        photoURL: photoURL ?? undefined,
        role,
        isOnline: role === 'listener',
        createdAt: serverTimestamp() as any,
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
      await setDoc(userRef, profile);
    } else {
      // Usuário existente: apenas atualiza informações básicas do perfil Google
      await setDoc(
        userRef,
        { name: displayName, photoURL, email },
        { merge: true }
      );
    }

    return { type: 'success', uid, isNewUser };
  } catch (error: any) {
    console.error('[googleAuth] handleGoogleResponse error:', error);
    return {
      type: 'error',
      message: error?.message ?? 'Erro ao autenticar com o Google.',
    };
  }
}
