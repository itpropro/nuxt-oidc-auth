<script setup lang="ts">
import { onDevtoolsClientConnected } from '@nuxt/devtools-kit/iframe-client'
import { ref, computed } from '#imports'
import type { NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit'

export interface OidcConfig {
  providers: Record<string, undefined>
  devMode: Record<'enabled', boolean>
  session: Record<'expirationCheck', boolean>
}

const devtoolsClient: NuxtDevtoolsIframeClient | null = ref(null)
const devAuthToken = ref<string | null>(localStorage.getItem('__nuxt_dev_token__'))
const oidcRuntimeConfig = ref()
const oidcConfig = ref<OidcConfig>()
const selectedProvider = ref('')
const oidcState = ref({})
const clientWindow = computed(() => devtoolsClient.value.host?.app)
const oidcSecrets = ref({})
const isDevAuthed = ref(false)

onDevtoolsClientConnected(async (client: NuxtDevtoolsIframeClient) => {
  // Getting devtools client
  devtoolsClient.value = client
  // Settings refs
  isDevAuthed.value = await devtoolsClient.value.devtools.rpc.verifyAuthToken(devAuthToken.value)
  oidcRuntimeConfig.value = isDevAuthed.value ? (await devtoolsClient.value.devtools.rpc.getServerRuntimeConfig()).oidc : {}
  oidcConfig.value = isDevAuthed.value ? (await devtoolsClient.value.devtools.rpc.getServerConfig()).oidc : {}
  oidcState.value = devtoolsClient.value.host.nuxt.payload.state['$snuxt-oidc-auth-session'] || {}
  oidcSecrets.value = isDevAuthed.value ? await devtoolsClient.value.devtools.extendClientRpc('nuxt-oidc-auth-rpc').getNuxtOidcAuthSecrets() : {}
})

async function login(provider?: string) {
  clientWindow.value.navigate(`/auth${provider ? '/' + provider : ''}/login`, true)
}

async function logout(provider?: string) {
  clientWindow.value.navigate(`/auth${provider ? '/' + provider : ''}/logout`, true)
}
</script>

<template>
  <div class="relative w-full flex flex-col h-screen">
    <div class="flex px-10 justify-start w-full flex-gap-2 top-0 fixed n-navbar-glass">
      <div class="mt-4">
        <h1 class="text-3xl font-bold">
          Nuxt OIDC Auth
        </h1>
        <p class="opacity-50 mb-4">
          Nuxt DevTools Integration
        </p>
      </div>
      <NButton
        n="green"
        class="ml-auto self-start mt-4"
        @click="login(selectedProvider)"
      >
        <span class="i-carbon-login" />
        Login
      </NButton>
      <NButton
        class="self-start mt-4"
        n="green"
        @click="logout(selectedProvider)"
      >
        <span class="i-carbon-logout" />
        Logout
      </NButton>
      <NButton
        class="self-start mt-4"
        n="green"
        @click="devtoolsClient!.host.devtools.reload()"
      >
        <span class="i-carbon-reset" />
        Refresh
      </NButton>
    </div>
    <NTip
      v-if="!isDevAuthed"
      class="relative mt-24"
      n="orange5"
      icon="i-carbon-locked"
      justify-center
    >
      Current DevTools session is not authorized, some features may be disabled.
    </NTip>
    <div
      v-if="oidcConfig"
      class="flex flex-col gap-2 p-10 pt-6"
      :class="{ 'mt-16': isDevAuthed }"
    >
      <AuthState :oidc-state />
      <ProviderConfigs
        :oidc-runtime-config
        :oidc-config
      />
      <Secrets :oidc-secrets />
      <DevMode :oidc-runtime-config />
    </div>
    <div
      v-else
      class="mt-16"
    >
      <NLoading />
    </div>
  </div>
</template>
