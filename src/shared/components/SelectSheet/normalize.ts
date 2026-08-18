/**
 * normalize — chave de comparação para a busca do SelectSheet.
 *
 * Fica em arquivo próprio, sem nenhum import de React Native, para poder ser
 * testada sem carregar a árvore de componentes.
 *
 * A classe de caracteres é escrita **escapada** (`̀-ͯ`) de propósito.
 * Escrita com os caracteres combinantes literais ela continua funcionando, mas
 * quebra em silêncio se algum editor renormalizar o arquivo — e uma busca que
 * para de achar "São Paulo" é o tipo de bug que ninguém liga ao commit certo.
 */
export function normalize(s: string): string {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
