import antfu from '@antfu/eslint-config'
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: false,
    standalone: false,
    stylistic: true,
  },
}, {
  rules: {
    'node/prefer-global/process': 'off',
  },
  ignores: ['.github/*'],
}).prepend(
  antfu(
    {
      unocss: false,
      markdown: true,
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
