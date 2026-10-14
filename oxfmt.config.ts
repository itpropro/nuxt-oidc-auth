import { defineOxfmtConfig } from '@visorian/code-standards/oxfmt'

export default defineOxfmtConfig({
  ignore: [
    '**/node_modules',
    '**/.nuxt',
    '**/.output',
    '**/.data',
    '**/dist',
    '**/coverage',
    '**/playwright-report',
    '**/test-results',
    '**/.playwright-cli',
    'pnpm-lock.yaml',
  ],
})
