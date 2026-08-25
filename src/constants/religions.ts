/**
 * religions.ts — Lista controlada de religião/crença para o perfil.
 * Campo opcional. "Outra" abre texto livre; "Prefiro não informar" é salvo literal.
 *
 * Além do rótulo (`religion`, texto), o perfil grava `religionKey`: uma chave
 * ESTÁVEL usada como filtro de busca no Explorar. O rótulo pode mudar de
 * acentuação/copy; a chave não. Nunca é exibida para terceiros.
 */

export const RELIGION_OTHER = 'Outra';
export const RELIGION_PREFER_NOT_SAY = 'Prefiro não informar';

export const RELIGION_OPTIONS: string[] = [
  'Católica',
  'Evangélica',
  'Espírita',
  'Umbanda',
  'Candomblé',
  'Budismo',
  'Judaísmo',
  'Islamismo',
  'Hinduísmo',
  'Religiões de matriz africana',
  'Sem religião',
  'Ateu / Ateia',
  'Agnóstico(a)',
  RELIGION_PREFER_NOT_SAY,
  RELIGION_OTHER,
];

/** Mapeamento rótulo → chave estável. Espelhado em meubest-api. */
export const RELIGION_KEYS = {
  'Católica': 'catolica',
  'Evangélica': 'evangelica',
  'Espírita': 'espirita',
  'Umbanda': 'umbanda',
  'Candomblé': 'candomble',
  'Budismo': 'budismo',
  'Judaísmo': 'judaismo',
  'Islamismo': 'islamismo',
  'Hinduísmo': 'hinduismo',
  'Religiões de matriz africana': 'matriz_africana',
  'Sem religião': 'sem_religiao',
  'Ateu / Ateia': 'ateu',
  'Agnóstico(a)': 'agnostico',
  'Prefiro não informar': 'nao_informar',
  'Outra': 'outra',
} as const;

export type ReligionLabel = keyof typeof RELIGION_KEYS;
export type ReligionKey = (typeof RELIGION_KEYS)[ReligionLabel];

/**
 * Chave para um rótulo. Texto livre (a resposta de "Outra") vira `'outra'`;
 * vazio/nulo devolve `null` (campo não preenchido).
 */
export function religionKeyFor(label: string | null | undefined): ReligionKey | null {
  const trimmed = typeof label === 'string' ? label.trim() : '';
  if (!trimmed) return null;
  const key = (RELIGION_KEYS as Record<string, ReligionKey>)[trimmed];
  return key ?? 'outra';
}

/**
 * Religiões que fazem sentido como filtro no Explorar: todas menos
 * "Prefiro não informar" e "Outra" (sem semântica de busca).
 */
export const FILTERABLE_RELIGIONS: ReadonlyArray<{ label: ReligionLabel; key: ReligionKey }> = (
  Object.keys(RELIGION_KEYS) as ReligionLabel[]
)
  .map((label) => ({ label, key: RELIGION_KEYS[label] }))
  .filter(({ key }) => key !== 'nao_informar' && key !== 'outra');
