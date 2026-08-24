/**
 * Tipos do Explorar — espelham os contratos de `GET /explore/*` na meubest-api.
 *
 * O app NUNCA vê o documento de usuário de um acolhedor: só este DTO público,
 * já com nome abreviado (`publicName`), sem e-mail, sem nome completo, sem
 * bloqueios. Visibilidade (aprovação, modo Acolher, bloqueio nos dois
 * sentidos, consentimento de foto) é decidida pelo servidor.
 */

/** Slots de foto: 0 é a foto do provider (Google/Apple), 1–3 são as próprias. */
export type ExplorePhotoSlot = 0 | 1 | 2 | 3;

export interface ExplorePhoto {
  slot: ExplorePhotoSlot;
  /**
   * URL ASSINADA com validade de 1 h. Contém credencial na query string —
   * nunca logar a URL inteira (ver `describePhotoUrl` em utils/exploreGallery).
   */
  url: string;
}

export interface PublicExploreProfile {
  uid: string;
  /** "Carlos F." — já abreviado pelo servidor. */
  publicName: string;
  /** Inicial para o avatar textual de fallback. */
  initial: string;
  ageRange: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  /** ids de `SESSION_THEMES`. */
  interests: string[];
  /** Pode receber FALAR AGORA (aprovado ∧ opt-in manual ∨ agenda agora). */
  reachable: boolean;
  /** Presença fresca — o pontinho "Ativo agora". */
  liveNow: boolean;
  photos: ExplorePhoto[];
}

export type ExploreAgeRange = '18-25' | '26-40' | '41-60' | '60+';

export type ExploreVisibilityState =
  | 'public'
  | 'not_approved'
  | 'not_in_listener_mode'
  | 'photo_consent_off';

export interface ExploreVisibility {
  state: ExploreVisibilityState;
  listedInExplore: boolean;
  photoConsent: boolean;
}

/** Query de `GET /explore/listeners`. Campos vazios são omitidos da URL. */
export interface ExploreListenersParams {
  search?: string;
  state?: string;
  theme?: string;
  religion?: string;
  ageRange?: ExploreAgeRange | '';
  onlyReachable?: boolean;
  limit?: number;
  offset?: number;
}

export interface ExploreListenersResponse {
  ok: boolean;
  items: PublicExploreProfile[];
  total: number;
  nextOffset: number | null;
}

export interface ExploreMeResponse {
  ok: boolean;
  profile: PublicExploreProfile;
  visibility: ExploreVisibility;
}
