export function isProductionEnvironment(environment = process.env.NODE_ENV): boolean {
  return environment?.toLowerCase().startsWith('prod') ?? false
}
