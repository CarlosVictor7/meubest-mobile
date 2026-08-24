/**
 * Religiões filtráveis no Explorar (key → label), na ordem em que aparecem no
 * seletor. Definida localmente para o Explorar não depender do módulo de
 * perfil — a chave é a mesma que a API aceita em `?religion=`.
 */
export interface ExploreReligionOption {
  key: string;
  label: string;
}

export const EXPLORE_RELIGIONS: readonly ExploreReligionOption[] = [
  { key: 'catolica', label: 'Católica' },
  { key: 'evangelica', label: 'Evangélica' },
  { key: 'espirita', label: 'Espírita' },
  { key: 'umbanda', label: 'Umbanda' },
  { key: 'candomble', label: 'Candomblé' },
  { key: 'budismo', label: 'Budismo' },
  { key: 'judaismo', label: 'Judaísmo' },
  { key: 'islamismo', label: 'Islamismo' },
  { key: 'hinduismo', label: 'Hinduísmo' },
  { key: 'matriz_africana', label: 'Religiões de matriz africana' },
  { key: 'sem_religiao', label: 'Sem religião' },
  { key: 'ateu', label: 'Ateu / Ateia' },
  { key: 'agnostico', label: 'Agnóstico(a)' },
];

export interface ExploreAgeRangeOption {
  value: '18-25' | '26-40' | '41-60' | '60+';
  label: string;
}

/** Faixas etárias filtráveis — os mesmos valores de `?ageRange=`. */
export const EXPLORE_AGE_RANGES: readonly ExploreAgeRangeOption[] = [
  { value: '18-25', label: '18–25 anos' },
  { value: '26-40', label: '26–40 anos' },
  { value: '41-60', label: '41–60 anos' },
  { value: '60+', label: '60+ anos' },
];
