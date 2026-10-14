declare module '#imports' {
  export { definePageMeta } from '#app/composables/pages'
  export { useOidcAuth } from './composables/oidcAuth'
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- An empty export makes these declarations module augmentations.
export {}
