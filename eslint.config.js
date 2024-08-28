import antfu from '@antfu/eslint-config'

export default antfu(
  {
    files: ['apps/**/*.ts', 'apps/**/*.vue'],
    unocss: true,
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
)
