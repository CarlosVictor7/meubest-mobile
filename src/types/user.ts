// Core types shared across web and mobile
// Ported from src/AuthContext.tsx in the web repo

import type { ReligionKey } from '@constants/religions';

export type UserRole = 'speaker' | 'listener' | 'admin';

/** Slot da galeria do Explorar — no máximo 3 fotos por usuário. */
export type ExplorePhotoSlot = 1 | 2 | 3;

/**
 * Metadata de UMA foto da galeria do Explorar.
 * O path NUNCA é gravado: é derivado de `users/{uid}/explore/photo-{slot}.jpg`
 * (ver `explorePhotoPath()` em `@shared/services/explorePhotoService`).
 */
export interface ExplorePhotoMeta {
  slot: ExplorePhotoSlot;
  /** Foto inativa continua no Storage mas não aparece para terceiros. */
  active: boolean;
}

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
  /**
   * Fuso IANA (ex.: "America/Sao_Paulo") capturado no MESMO write que salva a
   * agenda — nunca em heartbeat. A API usa isto para interpretar `availability`
   * no relógio do usuário; perfis antigos sem o campo caem no fallback
   * America/Sao_Paulo do lado do servidor.
   */
  availabilityTimezone?: string;
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
  /**
   * Timestamp do Firestore (serverTimestamp) gravado UMA única vez na transição
   * not_requested → training_requested. É a CHAVE DA FILA de treinamento: a
   * ordem vem do relógio do servidor, nunca do aparelho do usuário.
   */
  listenerTrainingRequestedAt?: unknown;
  /** UID de quem fez a última transição de `listenerStatus` (auditoria). */
  listenerStatusUpdatedBy?: string;
  /**
   * Path da foto enviada no Meu Best dentro do Storage
   * (`users/{uid}/profile/avatar.jpg` — path estável, substituição sobrescreve).
   */
  profilePhotoPath?: string;
  /**
   * downloadURL da foto enviada no Meu Best. Prioridade de exibição:
   * profilePhotoURL → photoURL (provider, legado) → inicial do nome.
   */
  profilePhotoURL?: string;
  // ── Explorar (galeria + consentimento) ─────────────────────────────
  /**
   * Consentimento para TERCEIROS verem as fotos no Explorar.
   * Ausente = false (opt-in explícito). Não bloqueia cadastro.
   */
  showPhotoInExplore?: boolean;
  /**
   * Metadata da galeria do Explorar (≤ 3 entradas, slots únicos, ordenada).
   * O path do arquivo é derivado do slot — nunca gravado aqui.
   */
  explorePhotos?: ExplorePhotoMeta[];
  /** Slot da foto principal (exibida primeiro). Inativa/removida → primeira ativa. */
  explorePrimaryPhotoSlot?: ExplorePhotoSlot;
  /**
   * Chave estável da religião (ver `religionKeyFor` em `@constants/religions`).
   * Usada SÓ como filtro de busca no Explorar — nunca exibida no perfil.
   */
  religionKey?: ReligionKey;
}
