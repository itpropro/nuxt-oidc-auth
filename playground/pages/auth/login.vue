<script setup lang="ts">
definePageMeta({
  layout: 'authentication'
})
const { currentProvider, login } = useOidcAuth()
const { providers } = useProviders(currentProvider.value as string)
</script>

<template>
  <div class="flex flex-col gap-4 items-center">
    <button
      v-for="(provider, index) in providers"
      :key="index"
      class="btn-base btn-login"
      :disabled="provider.disabled"
      @click="login(provider.name)"
    >
      <span :class="provider.icon" />
      <span class="pl-2">{{ provider.label }}</span>
    </button>
  </div>
</template>
