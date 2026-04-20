/**
 * Normaliza un texto para matching por keywords:
 * - minusculas
 * - sin tildes/diacriticos
 * - trim
 * - colapsa espacios
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
