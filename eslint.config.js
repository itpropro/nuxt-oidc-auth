import antfu from '@antfu/eslint-config'
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
    standalone: false,
  },
}, {
  rules: {
    'node/prefer-global/process': 'off',
  },
  ignores: ['.github/**', '**/*.md'],
}).prepend(
  antfu(
    {
      ignores: ['client/', 'docs/'],
      unocss: false,
      markdown: false,
      rules: {
        'operator-linebreak': 'off',
        'linebreak-style': ['error', 'unix'],
        'eol-last': ['error', 'always'],
        'node/prefer-global/process': 'off',
        'style/member-delimiter-style': [
          'error',
          {
            multiline: {
              delimiter: 'none',
              requireLast: false,
            },
            singleline: {
              delimiter: 'semi',
              requireLast: false,
            },
          },
        ],
      },
    },
  ),
)
