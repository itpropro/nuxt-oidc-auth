<script setup lang="ts">
definePageMeta({
  layout: 'authentication',
})
const { currentProvider, login } = useOidcAuth()
const { providers } = useProviders(currentProvider.value as string)
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <button
      v-for="(provider, index) in providers"
      :key="index"
      class="btn-base btn-login"
      :disabled="provider.disabled"
      @click="login(provider.name, { test: 'thiswillappearinentra', test2: 'thiswillbeignored' })"
    >
      <span :class="provider.icon" />
      <span class="pl-2">{{ provider.label }}</span>
    </button>
  </div>
</template>
