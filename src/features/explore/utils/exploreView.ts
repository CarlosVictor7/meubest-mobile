/**
 * exploreView — formatação e decisões de exibição do card do Explorar.
 *
 * Funções puras, sem React: é aqui que os testes garantem que o CTA "FALAR
 * AGORA" habilita pelos critérios certos e que os textos do card não regridem.
 */
import { isListenerPushEligibleNow } from '@shared/utils/availability';
import type { AvailabilitySource } from '@shared/utils/availability';
import { isAvailableNow } from '@shared/utils/presence';
import { SESSION_THEMES } from '@constants/config';
import type { ExploreFilters } from './exploreFilters';

/** Quantos chips de tema o card mostra antes do "+N". */
export const MAX_THEME_CHIPS = 3;

/**
 * "26-40" → "26–40 anos" (en-dash), "60+" → "60+ anos".
 * Ausente/vazio → null (a linha é omitida).
 */
export function formatAgeRange(ageRange: string | null | undefined): string | null {
  const trimmed = typeof ageRange === 'string' ? ageRange.trim() : '';
  if (!trimmed) return null;
  return `${trimmed.replace(/-/g, '–')} anos`;
}

/**
 * `city` é gravada como "São Paulo - SP" (formato composto) e vence a UF.
 * Exibimos como está — reformatar arriscaria estragar valores antigos.
 * Ambos ausentes → null (a linha é omitida).
 */
export function formatLocation(
  city: string | null | undefined,
  state: string | null | undefined
): string | null {
  const c = typeof city === 'string' ? city.trim() : '';
  if (c) return c;
  const s = typeof state === 'string' ? state.trim() : '';
  return s || null;
}

/** Indicador de posição: "3 de 12". Índice zero-based. */
export function formatExploreProgress(index: number, total: number): string {
  if (total <= 0) return '';
  const clamped = Math.min(Math.max(index, 0), total - 1);
  return `${clamped + 1} de ${total}`;
}

export interface TalkNowAvailability {
  /**
   * O CTA "FALAR AGORA" habilita? Reusa `isListenerPushEligibleNow`:
   * canActAsListener ∧ (opt-in manual ∨ agenda programada agora). É o mesmo
   * critério da push — se a chamada pode chegar, o botão pode chamar.
   */
  canTalkNow: boolean;
  /** Presença fresca (chave ligada + lastSeenAt recente) — o pontinho "Ativo agora". */
  liveNow: boolean;
}

export function getTalkNowAvailability(
  profile: AvailabilitySource | null | undefined,
  nowMs: number = Date.now()
): TalkNowAvailability {
  return {
    canTalkNow: isListenerPushEligibleNow(profile, new Date(nowMs)),
    liveNow: isAvailableNow(profile, nowMs),
  };
}

export interface ThemeChip {
  id: string;
  label: string;
  emoji: string;
}

export interface ThemeChipsResult {
  chips: ThemeChip[];
  /** Quantos temas ficaram de fora — vira o chip "+N". */
  extra: number;
}

/**
 * Resolve ids de interesse em chips de tema. Ids desconhecidos são ignorados
 * e NÃO contam no "+N" — um id órfão no banco não vira um "+1" mentiroso.
 */
export function getThemeChips(
  interests: string[] | null | undefined,
  max: number = MAX_THEME_CHIPS
): ThemeChipsResult {
  const resolved = (interests ?? [])
    .map((id) => SESSION_THEMES.find((t) => t.id === id))
    .filter((t): t is (typeof SESSION_THEMES)[number] => Boolean(t))
    .map((t) => ({ id: t.id, label: t.label, emoji: t.emoji }));

  return {
    chips: resolved.slice(0, max),
    extra: Math.max(0, resolved.length - max),
  };
}

/** Quantos filtros estão ativos — o badge do botão de filtros do header. */
export function countActiveFilters(filters: ExploreFilters): number {
  let count = 0;
  if (filters.search?.trim()) count++;
  if (filters.state) count++;
  if (filters.themeId) count++;
  if (filters.onlyOnline) count++;
  return count;
}
