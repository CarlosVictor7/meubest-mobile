// Core types shared across web and mobile
// Ported from src/AuthContext.tsx in the web repo

export type UserRole = 'speaker' | 'listener' | 'admin';

/**
 * Autorização para atuar como acolhedor.
 *
 * NÃO substitui `role`. Os dois convivem com semânticas distintas:
 *   role           → o modo atual (o que a pessoa está fazendo agora)
 *   listenerStatus → a autorização (o que a pessoa pode fazer)
 *
 * Ausência do campo equivale a `not_requested`, resolvido na leitura por
 * `getListenerStatus()` — nenhum usuário precisa ser migrado para ser lido.
 *
 * ⚠️ Declarado aqui como PREPARAÇÃO. Nada lê nem escreve este campo até a
 * Sprint 6, que traz o enforcement, as Rules e a migração de grandfathering.
 */
export type ListenerStatus =
  | 'not_requested'
  | 'training_requested'
  | 'in_training'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface BankDetails {
  pix?: string;
  bankName?: string;
  accountNumber?: string;
  pixKeyType?: string;
}

export interface UserProfile {
  uid: string;
  /**
   * Nome legado/original vindo do provider (Google/Apple/Firebase).
   * NUNCA é sobrescrito por telas de perfil — só `googleAuth`/`appleAuth` escrevem aqui.
   * Para exibir o nome de uma pessoa, use `getDisplayName()` de `@shared/utils/displayName`.
   */
  name: string;
  email: string;
  role: UserRole;
  /**
   * Nome público escolhido pelo usuário ("Como você quer ser chamado?").
   * Opcional no tipo por compatibilidade: usuários antigos não têm o campo.
   * Obrigatório na UI de cadastro novo (validação de etapa do ProfileForm).
   */
  preferredName?: string;
  /** "Sobre você" — texto livre opcional, limitado a BIO_MAX_LENGTH caracteres. */
  bio?: string;
  city?: string;
  state?: string;
  religion?: string;
  gender?: string;
  ageRange?: string;
  interests?: string[];
  cameraPreference?: string;
  balance?: number;
  totalEarnings?: number;
  rating?: number;
  isProfileComplete?: boolean;
  showTutorial?: boolean;
  /** Intenção declarada pelo usuário ao virar a chave. Ver `@shared/utils/presence`. */
  isOnline?: boolean;
  /**
   * ISO 8601 — última vez que o app confirmou presença.
   * `isOnline` sozinho não basta: se o sistema mata o app, ninguém desliga a
   * chave. Consumidores descartam presença obsoleta na leitura.
   */
  lastSeenAt?: string;
  gratitudeCoins?: number;
  currentStreak?: number;
  lastCheckIn?: string;
  badges?: string[];
  points?: number;
  level?: number;
  sessionsCount?: number;
  referralCount?: number;
  referralCode?: string;
  rewardBalance?: number;
  availability?: { [date: string]: string[] };
  bankDetails?: BankDetails;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
  isAdult?: boolean;
  pushToken?: string;
  pushTokenPlatform?: string;
  pushTokenUpdatedAt?: string;
  // ── Auth provider ───────────────────────────────────────────────
  /** Provider primário usado no primeiro login: 'google' | 'apple' | 'unknown' */
  authProvider?: 'google' | 'apple' | 'unknown';
  /** Lista de provider IDs vinculados à conta Firebase (ex: ['google.com', 'apple.com']) */
  providerIds?: string[];
  /**
   * E-mail de relay privado da Apple (ex: xyz@privaterelay.appleid.com).
   * A Apple fornece esse e-mail quando o usuário escolhe "Ocultar meu e-mail".
   * Armazenado separadamente para não sobrescrever o campo `email` principal.
   */
  applePrivateEmail?: string;
  /**
   * Lista de UIDs bloqueados por este usuário.
   * Atualizada com arrayUnion no VideoRoomScreen ao bloquear durante chamada.
   */
  blockedUserIds?: string[];
  /**
   * Autorização para acolher. Ver `ListenerStatus`.
   * PREPARAÇÃO — nada lê nem escreve até a Sprint 6.
   */
  listenerStatus?: ListenerStatus;
}
