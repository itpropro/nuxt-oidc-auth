import { defineVueEslintConfig } from '@visorian/code-standards/eslint'

import oxlint from './oxlint.config.ts'

const config = defineVueEslintConfig({
  oxlint,
  singleWordComponents: [
    '**/app.vue',
    '**/error.vue',
    '**/layouts/**/*.vue',
    '**/pages/**/*.vue',
    '**/components/Secrets.vue',
  ],
})

export default config
