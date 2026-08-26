/**
 * toggleHint — regras puras do "peek" educativo do toggle Desabafar|Acolher.
 *
 * Nas 3 primeiras aberturas do app o thumb dá 2 cicladas de 6–8 px em direção
 * ao lado inativo e volta (~1,2 s no total), sem mudar o estado real. Depois
 * disso, nunca mais. Com "reduzir movimento" ligado no sistema: sem peek e a
 * troca de segmento acontece sem spring.
 */

export const TOGGLE_HINT_STORAGE_KEY = '@meubest:toggleHintCount';
export const TOGGLE_HINT_MAX_SHOWS = 3;

/** Deslocamento do peek em px (dentro da faixa 6–8 combinada). */
export const TOGGLE_PEEK_DISTANCE = 7;
/** Ciclos ida-e-volta. */
export const TOGGLE_PEEK_CYCLES = 2;
/** Duração de cada perna (ida ou volta) — 2 ciclos × 2 pernas × 300 = 1,2 s. */
export const TOGGLE_PEEK_LEG_MS = 300;
export const TOGGLE_PEEK_TOTAL_MS = TOGGLE_PEEK_CYCLES * 2 * TOGGLE_PEEK_LEG_MS;

/** Lê o contador persistido; qualquer lixo vira 0. */
export function parseToggleHintCount(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function shouldShowToggleHint(count: number, reduceMotion: boolean): boolean {
  if (reduceMotion) return false;
  if (!Number.isFinite(count) || count < 0) return true;
  return count < TOGGLE_HINT_MAX_SHOWS;
}

/**
 * Sinal do deslocamento: o thumb vai "espiar" o lado INATIVO. Com o segmento
 * 0 ativo, o inativo está à direita (+); com o último ativo, à esquerda (−).
 */
export function peekDirection(activeIndex: number, optionCount: number): 1 | -1 {
  if (optionCount <= 1) return 1;
  return activeIndex >= optionCount - 1 ? -1 : 1;
}
