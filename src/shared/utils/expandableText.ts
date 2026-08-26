/**
 * expandableText — decisão pura do "VER MAIS": o texto transborda o recolhido?
 * `lineCount` vem do `onTextLayout` de um Text de medição (sem numberOfLines);
 * `null` = ainda não medido → sem botão (evita o flash em texto curto).
 */
export function bioOverflow(
  lineCount: number | null | undefined,
  collapsedLines: number
): boolean {
  if (typeof lineCount !== 'number' || !Number.isFinite(lineCount)) return false;
  return lineCount > collapsedLines;
}
