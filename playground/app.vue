<script setup lang="ts">
const { loggedIn, user, refresh } = useUserSession()

const providers = computed(() => [
  {
    label: 'Microsoft Entra ID',
    to: '/auth/entra/login',
    disabled: Boolean(user.value.provider === 'entra'),
    icon: 'i-simple-icons-microsoftazure',
  },
  {
    label: 'Auth0',
    to: '/auth/auth0/login',
    disabled: Boolean(user.value.provider === 'auth0'),
    icon: 'i-simple-icons-auth0',
  },
  {
    label: 'GitHub',
    to: '/auth/github/login',
    disabled: Boolean(user.value.provider === 'github'),
    icon: 'i-simple-icons-github',
  },
].map(p => ({
  ...p,
  prefetch: false,
  external: true,
})))
</script>

<template>
  <UHeader>
    <template #logo>
      Nuxt Oidc Auth
    </template>
    <template #right>
      <UDropdown :items="[providers]">
        <UButton
          icon="i-heroicons-chevron-down"
          trailing
          color="gray"
          size="xs"
        >
          Login with
        </UButton>
      </UDropdown>
      <UButton
        v-if="loggedIn"
        color="gray"
        size="xs"
        @click="navigateTo(`/auth/${user.provider}/logout`, { external: true })"
      >
        Logout
      </UButton>
      <UButton
        v-if="user?.canRefresh"
        color="gray"
        size="xs"
        @click="refresh"
      >
        Refresh token
      </UButton>
    </template>
  </UHeader>
  <UMain>
    <UContainer>
      <NuxtPage />
    </UContainer>
  </UMain>
</template>
