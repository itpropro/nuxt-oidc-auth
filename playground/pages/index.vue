<script setup lang="ts">
const { loggedIn, user, refresh, login, logout, currentProvider } = useOidcAuth()

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
  <div class="w-full grid grid-cols-2 justify-center items-center">
    <div class="col-start-1 flex flex-col gap-4 items-center">
      <p class="text-xl">
        Login with
      </p>
      <button
        class="btn-base btn-login"
        @click="login()"
      >
        <span class="i-majesticons-login-line" />
        <span class="pl-2">Default provider</span>
      </button>
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
      <p>Logged in: {{ loggedIn }}</p>
      <button
        class="btn-base btn-login"
        :disabled="!loggedIn"
        @click="refresh()"
      >
        <span class="i-majesticons-refresh" />
        <span class="pl-2">Refresh</span>
      </button>
      <button
        class="btn-base btn-login"
        :disabled="!loggedIn"
        @click="logout(currentProvider)"
      >
        <span class="i-majesticons-logout-line" />
        <span class="pl-2">Logout</span>
      </button>
    </div>
    <div class="col-start-2">
      <p class="pb-4 text-xl">
        User object
      </p>
      <div
        v-for="(value, key, index) in user"
        :key="index"
      >
        <span class="font-bold text-base">
          {{ `${key}` }}
        </span>
        <p class="text-sm pb-3">
          {{ value }}
        </p>
      </div>
    </div>
  </div>
</template>
