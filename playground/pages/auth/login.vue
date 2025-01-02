<script setup lang="ts">
definePageMeta({
  layout: 'authentication',
})
const { currentProvider, login } = useOidcAuth()
const { providers } = useProviders(currentProvider.value as string)
// use `@click="login(provider.name as any, { test: 'thiswillappearinentra', test2: 'thiswillbeignored' })"` for testing the logout params
</script>

<template>
  <div class="flex gap-2 justify-center">
    <div class="flex flex-col items-center gap-4">
      <button
        v-for="(provider, index) in providers"
        :key="index"
        class="btn-base btn-login"
        :disabled="provider.disabled"
        @click="login(provider.name as any)"
      >
        <span :class="provider.icon" />
        <span class="pl-2">{{ provider.label }}</span>
      </button>
    </div>
    <div class="flex flex-col items-center gap-4">
      <button
        v-for="(provider, index) in providers"
        :key="index"
        class="btn-base btn-login"
        :disabled="provider.disabled"
        @click="login(provider.name as any, { redirectUri: `http://localhost:4000/auth/${provider.name}/callback` })"
      >
        <span :class="provider.icon" />
        <span class="pl-2">{{ provider.label }} redirect</span>
      </button>
    </div>
  </div>
</template>
