import {
  guidanceMode, emphasisSequence, sideOpacity,
  GUIDANCE_STATIC_OPACITY, GUIDANCE_DIM_OPACITY, GUIDANCE_EMPHASIS_OPACITY, GUIDANCE_HEIGHT,
} from '../toggleGuidance';
import { TOGGLE_HINT_MAX_SHOWS } from '../toggleHint';

describe('toggleGuidance — indicação orgânica acima do toggle', () => {
  it('anima nas 3 primeiras aberturas, depois fica estática (mas continua visível)', () => {
    for (let c = 0; c < TOGGLE_HINT_MAX_SHOWS; c++) expect(guidanceMode(c, false)).toBe('animated');
    expect(guidanceMode(TOGGLE_HINT_MAX_SHOWS, false)).toBe('static');
    expect(guidanceMode(99, false)).toBe('static');
  });
  it('Reduce Motion → sempre estática, nunca escondida', () => {
    expect(guidanceMode(0, true)).toBe('static');
    expect(sideOpacity('left', null)).toBe(GUIDANCE_STATIC_OPACITY);
    expect(GUIDANCE_STATIC_OPACITY).toBeGreaterThan(0);
  });
  it('sequência alterna esquerda ↔ direita (2 ciclos = 4 passos)', () => {
    expect(emphasisSequence()).toEqual(['left', 'right', 'left', 'right']);
    expect(emphasisSequence(0)).toEqual([]);
  });
  it('lado enfatizado fica opaco, o outro esmaece; estático = ambos iguais', () => {
    expect(sideOpacity('left', 'left')).toBe(GUIDANCE_EMPHASIS_OPACITY);
    expect(sideOpacity('right', 'left')).toBe(GUIDANCE_DIM_OPACITY);
    expect(sideOpacity('right', null)).toBe(sideOpacity('left', null));
  });
  it('ocupa pouca altura (20–32 px)', () => {
    expect(GUIDANCE_HEIGHT).toBeGreaterThanOrEqual(20);
    expect(GUIDANCE_HEIGHT).toBeLessThanOrEqual(32);
  });
});
