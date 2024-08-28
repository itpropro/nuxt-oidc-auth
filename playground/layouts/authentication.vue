<script setup lang="ts">
const colorMode = useColorMode()
</script>

<template>
  <div
    class="relative h-100dvh flex flex-col items-center justify-center text-center bg-base font-base"
  >
    <div class="py-8 text-2xl">
      <p>
        Please login
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
      class="dark:from-brand-blue dark:via-brand-blue dark:to-brand-blueDark w-full flex-1 overflow-y-auto p-4 dark:(bg-gradient-to-tr) sm:px-8 sm:py-6"
    >
      <slot />
    </main>
  </div>
</template>
