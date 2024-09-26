<script setup lang="ts">
const { loggedIn, user, refresh, fetch, login, logout, currentProvider, clear } = useOidcAuth()
const { providers } = useProviders(currentProvider.value as string)
const refreshing = ref(false)
async function handleRefresh() {
  refreshing.value = true
  await refresh()
  refreshing.value = false
}
</script>

<template>
  <div class="grid grid-cols-2 w-full">
    <div class="col-start-1 flex flex-col items-center gap-4">
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
        @click="login(provider.name as any)"
      >
        <span :class="provider.icon" />
        <span class="pl-2">{{ provider.label }}</span>
      </button>
      <p>Logged in: {{ loggedIn }}</p>
      <p>Current provider: {{ currentProvider }}</p>
      <button
        class="btn-base btn-login"
        :disabled="!loggedIn || !user?.canRefresh || refreshing"
        @click="handleRefresh()"
      >
        <span class="i-majesticons-refresh" />
        <span class="pl-2">Refresh</span>
      </button>
      <button
        class="btn-base btn-login"
        :disabled="!loggedIn"
        @click="fetch()"
      >
        <span class="i-majesticons-refresh" />
        <span class="pl-2">Fetch</span>
      </button>
      <button
        class="btn-base btn-login"
        :disabled="!loggedIn"
        @click="logout(currentProvider)"
      >
        <span class="i-majesticons-logout-line" />
        <span class="pl-2">Logout</span>
      </button>
      <button
        class="btn-base btn-login"
        :disabled="!loggedIn"
        @click="clear()"
      >
        <span class="i-majesticons-delete-bin-line" />
        <span class="pl-2">Clear session</span>
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
        <span class="text-base font-bold">
          {{ `${key}` }}
        </span>
        <p class="break-all pb-3 text-sm">
          {{ value }}
        </p>
      </div>
    </div>
  </div>
</template>
