/**
 * Indicador orgânico acima do toggle DESABAFAR | ACOLHER: duas curvas com
 * ponta de seta, uma para cada lado. Regras puras (testadas):
 * - `guidanceMode`: nas 3 primeiras aberturas (mesmo contador do peek,
 *   `@meubest:toggleHintCount`) a indicação ANIMA (ênfase alternada esquerda ↔
 *   direita); depois permanece VISÍVEL, estática e mais sutil. Reduce Motion:
 *   sempre estática (mas visível).
 * - `emphasisSequence`: ordem das ênfases da animação (nunca toca o estado real).
 */
import { shouldShowToggleHint } from './toggleHint';

export type GuidanceMode = 'animated' | 'static';
export type GuidanceSide = 'left' | 'right';

export const GUIDANCE_HEIGHT = 26;
export const GUIDANCE_STATIC_OPACITY = 0.55;
export const GUIDANCE_DIM_OPACITY = 0.3;
export const GUIDANCE_EMPHASIS_OPACITY = 1;
export const GUIDANCE_SHIFT_PX = 3;
export const GUIDANCE_LEG_MS = 380;
export const GUIDANCE_CYCLES = 2;

export function guidanceMode(count: number, reduceMotion: boolean): GuidanceMode {
  return shouldShowToggleHint(count, reduceMotion) ? 'animated' : 'static';
}

/** Ênfases alternadas: esquerda, direita, esquerda, direita… (cycles × 2). */
export function emphasisSequence(cycles: number = GUIDANCE_CYCLES): GuidanceSide[] {
  const out: GuidanceSide[] = [];
  for (let i = 0; i < Math.max(0, cycles); i++) out.push('left', 'right');
  return out;
}

/** Opacidade de cada lado num dado passo (o outro lado esmaece). */
export function sideOpacity(side: GuidanceSide, emphasized: GuidanceSide | null): number {
  if (emphasized === null) return GUIDANCE_STATIC_OPACITY;
  return side === emphasized ? GUIDANCE_EMPHASIS_OPACITY : GUIDANCE_DIM_OPACITY;
}
