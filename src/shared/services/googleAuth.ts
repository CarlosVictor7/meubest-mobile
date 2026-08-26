/**
 * googleAuth.ts — Google Sign-In service nativo
 *
 * Encapsula o fluxo de autenticação Google para o Meu Best Mobile usando a lib nativa.
 *
 * IMPORTANTE:
 * - No Expo Go: sempre lança erro `expoGoLimitation` (pois usa código nativo não suportado no Go).
 * - No Development Build (EAS): funciona completamente usando o SDK nativo do Google
 *   e GoogleAuthProvider do Firebase.
 *
 * Refs:
 * - https://github.com/react-native-google-signin/google-signin
 * - https://firebase.google.com/docs/auth/web/google-signin
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import { appConfig } from '@constants/appConfig';
import { buildProviderPatch } from '@shared/utils/providerPatch';
import { LISTENER_APPROVAL_ENFORCED } from '@shared/utils/listener';
import type { UserProfile } from '@models/user';

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

// Configuração estática do GoogleSignin
GoogleSignin.configure({
  webClientId: appConfig.googleWebClientId, // Obrigatório para Firebase
  iosClientId: appConfig.googleIosClientId,
  // scopes: ['profile', 'email'], // Defaults já incluem profile e email
});

/**
 * Inicia o fluxo de Sign-In do Google nativo e integra com Firebase Auth.
 *
 * @param role - papel selecionado na RoleSelectionScreen ('speaker' | 'listener')
 */
export async function signInWithGoogle(
  role: 'speaker' | 'listener' = 'speaker'
): Promise<GoogleSignInResult> {
  if (isExpoGo()) {
    return { type: 'expoGoLimitation' };
  }

  try {
    // 1. Verifica dependências do Google Play Services (Android)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // 2. Abre o pop-up nativo de autenticação do Google
    const userInfo = await GoogleSignin.signIn();
    
    // 3. Verifica o token ID
    if (!userInfo.data?.idToken) {
      return { type: 'error', message: 'Token de autenticação inválido ou ausente.' };
    }

    // 4. Cria a credencial no Firebase Auth
    const credential = GoogleAuthProvider.credential(userInfo.data.idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const { uid, displayName, email, photoURL } = userCredential.user;

    // 5. Upsert de perfil mínimo no Firestore (preparando para a próxima task)
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const isNewUser = !userSnap.exists();

    if (isNewUser) {
      // Enforcement (19/08): ninguém NASCE acolhedor. Quem escolheu "Acolher"
      // no onboarding entra como speaker e é conduzido à fila de treinamento
      // pelo toggle (as Rules negariam role='listener' sem aprovação no update;
      // criar já no modo certo evita um estado de UI sem poderes).
      const effectiveRole = LISTENER_APPROVAL_ENFORCED ? 'speaker' : role;
      const profile: Partial<UserProfile> = {
        uid,
        name: displayName ?? 'Usuário',
        email: email ?? '',
        photoURL: photoURL ?? undefined,
        role: effectiveRole,
        isOnline: effectiveRole === 'listener',
        // lastSeenAt acompanha isOnline desde o nascimento (ver @shared/utils/presence).
        ...(effectiveRole === 'listener' ? { lastSeenAt: new Date().toISOString() } : {}),
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
      await setDoc(userRef, profile);
    } else {
      // Usuário existente: atualiza SÓ o que o Google realmente forneceu.
      //
      // `merge: true` mescla CHAVES, não valores — uma chave com null
      // SOBRESCREVE o dado bom. `displayName: null` apagava o nome de quem já
      // usava o app, e `email: null` violava `isValidUser` nas Rules, negando
      // a escrita inteira. `buildProviderPatch` omite tudo que for nulo/vazio
      // e NUNCA inclui `preferredName` (escolha do usuário, provider não toca).
      const patch = buildProviderPatch({ displayName, photoURL, email });
      if (Object.keys(patch).length > 0) {
        await setDoc(userRef, patch, { merge: true });
      }
    }

    return { type: 'success', uid, isNewUser };
  } catch (error: any) {
    console.error('[googleAuth] signInWithGoogle error:', error);
    
    // Identificar cancelamento do usuário
    if (error.code === 'SIGN_IN_CANCELLED' || error.code === '12501') {
      return { type: 'cancelled' };
    }

    // Firestore inalcançável. Aqui o login no Auth JÁ funcionou — o que falhou
    // foi ler o perfil. Falhar é deliberado: sem saber se o documento existe,
    // seguir em frente e criar um novo sobrescreveria pontos, nível, moedas e
    // saldo de quem já tem conta. Perder o login é recuperável; perder o
    // histórico da pessoa não é.
    const offline =
      error?.code === 'unavailable' ||
      /client is offline|Could not reach Cloud Firestore/i.test(error?.message ?? '');

    if (offline) {
      return {
        type: 'error',
        message:
          'Não conseguimos falar com o servidor agora. Confira sua conexão e tente de novo em instantes.',
      };
    }

    return {
      type: 'error',
      message: error?.message ?? 'Erro ao autenticar com o Google.',
    };
  }
}
