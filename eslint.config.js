import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    typescript: false,
    imports: false,
    jsonc: false,
    lessOpinionated: true,
    stylistic: false,
    ignores: [
      'node_modules',
      '.nuxt',
      '.output',
      'dist',
      'docs',
      'client',
      'playground',
      'playwright-report',
      'test-results',
      'test/fixtures',
    ],
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: false,
      },
    },
    rules: {
      'vue/html-self-closing': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
    },
  },
)
