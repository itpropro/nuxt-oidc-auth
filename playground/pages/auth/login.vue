<script setup lang="ts">
definePageMeta({
  layout: 'authentication'
})
const { user, login } = useOidcAuth()

const providers = ref([
  {
    label: 'Microsoft Entra ID',
    name: 'entra',
    disabled: Boolean(user.value.provider === 'entra'),
    icon: 'i-simple-icons-microsoftazure',
  },
  {
    label: 'Auth0',
    name: 'auth0',
    disabled: Boolean(user.value.provider === 'auth0'),
    icon: 'i-simple-icons-auth0',
  },
  {
    label: 'GitHub',
    name: 'github',
    disabled: Boolean(user.value.provider === 'github'),
    icon: 'i-simple-icons-github',
  },
])
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
