import { defineOxlintConfig } from '@visorian/code-standards/oxlint'

export default defineOxlintConfig({
  // This fixture checks built declarations separately through test:types:dist.
  ignore: ['test/fixtures/publicTypes'],
  scripts: ['**/*.config.{ts,mts,mjs}', '**/scripts/**', 'test/setup/*.mjs'],
})
