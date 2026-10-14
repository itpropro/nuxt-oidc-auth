import { defineVueEslintConfig } from '@visorian/code-standards/eslint'

import oxlint from './oxlint.config.ts'

export default [
  ...defineVueEslintConfig({
    oxlint,
    singleWordComponents: [
      '**/app.vue',
      '**/error.vue',
      '**/layouts/**/*.vue',
      '**/pages/**/*.vue',
      '**/components/Secrets.vue',
    ],
  }),
  {
    files: ['**/components/content/contentImage.vue'],
    // Existing fit prop is accepted but unused. Keep this debt visible until its behavior is decided.
    rules: { 'vue/no-unused-properties': 'warn' },
  },
]
