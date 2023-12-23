<script setup lang="ts">
const colorMode = useColorMode()
</script>

<template>
  <div
    class="relative h-100dvh flex flex-col bg-base font-base justify-center items-center divide-y text-center divide-gray-400 dark:divide-gray-200"
  >
    <div class="py-8 text-2xl">
      <p>
        Nuxt OIDC Auth
      </p>
      <div class="absolute right-16 top-8 text-5">
        <button
          v-if="colorMode.preference === 'light'"
          @click="colorMode.preference = 'dark'"
        >
          <span class="i-majesticons-sun" />
        </button>
        <button
          v-else
          @click="colorMode.preference = 'light'"
        >
          <span class="i-majesticons-moon" />
        </button>
      </div>
    </div>
    <main
      class="flex-1 w-full overflow-y-auto p-4 dark:(from-brand-blue via-brand-blue to-brand-blueDark bg-gradient-to-tr) sm:px-8 sm:py-6"
    >
      <slot />
    </main>
  </div>
</template>
