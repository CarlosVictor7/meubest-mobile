/**
 * religions.ts — Lista controlada de religião/crença para o perfil.
 * Campo opcional. "Outra" abre texto livre; "Prefiro não informar" é salvo literal.
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
