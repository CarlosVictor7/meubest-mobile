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
      // Usuário existente: apenas atualiza informações básicas vindo do Google
      await setDoc(
        userRef,
        { name: displayName, photoURL, email },
        { merge: true }
      );
    }

    return { type: 'success', uid, isNewUser };
  } catch (error: any) {
    console.error('[googleAuth] signInWithGoogle error:', error);
    
    // Identificar cancelamento do usuário
    if (error.code === 'SIGN_IN_CANCELLED' || error.code === '12501') {
      return { type: 'cancelled' };
    }

    return {
      type: 'error',
      message: error?.message ?? 'Erro ao autenticar com o Google.',
    };
  }
}
