export function snakeCase(input: string): string {
  return input
    .replaceAll(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replaceAll(/[\s-]+/gu, '_')
    .toLowerCase()
}
