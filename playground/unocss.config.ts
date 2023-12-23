// @unocss-include

import {
  defineConfig,
  presetIcons,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    {
      'bg-base': 'bg-white dark:bg-gray-900',
      'font-initial': 'font-alexandria text-sm font-400',
      'font-base': 'text-gray-950 dark:text-gray-100 font-initial',
      'font-base-reverse': 'dark:text-gray-950 text-gray-100 font-initial',
      'btn-base': 'whitespace-nowrap flex justify-center items-center h-10 px-4 border-1 bg-gray-100 dark:bg-gray-800 border-gray-400 text-sm leading-4 rounded-2 transition ease-in-out duration-150 disabled:cursor-not-allowed disabled:(text-black dark:text-white) disabled:opacity-50',
      'btn-login': 'w-60 hover:enabled:bg-gray dark:hover:enabled:text-gray-900 hover:enabled:text-white hover:enabled:drop-shadow-[0_2px_5px_rgba(160,160,160,0.6)] active:enabled:filter-none',
    }
  ],
  presets: [
    presetUno({
      dark: 'class',
    }),
    presetIcons({
      warn: true,
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetWebFonts({
      provider: 'bunny',
      fonts: {
        sans: 'Alexandria',
        serif: 'PT Serif',
        mono: 'Roboto Mono',
        alexandria: [
          {
            name: 'Alexandria',
            weights: ['300', '400', '700'],
            italic: true,
          },
          {
            name: 'sans-serif',
            provider: 'none',
          },
        ],
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
