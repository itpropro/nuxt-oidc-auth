<script setup lang="ts">
import type { NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'
import { onDevtoolsClientConnected } from '@nuxt/devtools-kit/iframe-client'
import { computed, ref } from 'vue'

export interface OidcConfig {
  providers: Record<string, unknown>
  devMode: Record<string, unknown>
}

type OidcSecrets = Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>
interface OidcDevtoolsServerFunctions {
  getNuxtOidcAuthSecrets: (token: string) => Promise<OidcSecrets>
}

function emptyOidcConfig(): OidcConfig {
  return { providers: {}, devMode: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getOidcConfig(config: unknown): OidcConfig | undefined {
  if (!isRecord(config)) return
  const oidc = config.oidc
  if (!isRecord(oidc)) return

  const providers = isRecord(oidc.providers) ? oidc.providers : {}
  const devMode = isRecord(oidc.devMode) ? oidc.devMode : {}

  return { providers, devMode }
}

const showLoginDropdown = ref(false)
const showLogoutDropdown = ref(false)
const devtoolsClient = ref<NuxtDevtoolsIframeClient>()
const devAuthToken = ref<string | null>(localStorage.getItem('__nuxt_dev_token__'))
const oidcRuntimeConfig = ref<OidcConfig>(emptyOidcConfig())
const oidcConfig = ref<OidcConfig>()
const oidcState = ref({})
const clientWindow = computed(() => devtoolsClient.value?.host.app)
const oidcSecrets = ref<OidcSecrets>({
  tokenKey: '',
  sessionSecret: '',
  authSessionSecret: '',
})
const isDevAuthed = ref(false)
const registeredProviders = computed(() => oidcConfig.value?.providers ? oidcConfig.value?.providers : {})

onDevtoolsClientConnected(async (client: NuxtDevtoolsIframeClient) => {
  // Getting devtools client
  devtoolsClient.value = client
  // Settings refs
  isDevAuthed.value = devAuthToken.value !== null && await devtoolsClient.value.devtools.rpc.verifyAuthToken(devAuthToken.value)
  oidcRuntimeConfig.value = isDevAuthed.value
    ? getOidcConfig(await devtoolsClient.value.devtools.rpc.getServerRuntimeConfig()) || emptyOidcConfig()
    : emptyOidcConfig()
  oidcConfig.value = isDevAuthed.value
    ? getOidcConfig(await devtoolsClient.value.devtools.rpc.getServerConfig())
    : undefined
  oidcState.value = devtoolsClient.value.host.nuxt.payload.state['$snuxt-oidc-auth-session'] || {}
  const oidcRpc = devtoolsClient.value.devtools.extendClientRpc<
    OidcDevtoolsServerFunctions,
    Record<string, never>
  >('nuxt-oidc-auth-rpc', {})
  oidcSecrets.value = isDevAuthed.value
    ? await oidcRpc.getNuxtOidcAuthSecrets(devAuthToken.value || '')
    : { tokenKey: '', sessionSecret: '', authSessionSecret: '' }
})

async function login(provider?: string) {
  clientWindow.value?.navigate(`/auth${provider ? `/${provider}` : ''}/login`, true)
}

async function logout(provider?: string) {
  clientWindow.value?.navigate(`/auth${provider ? `/${provider}` : ''}/logout`, true)
}
</script>

<template>
  <div class="relative h-screen w-full flex flex-col">
    <div class="fixed top-0 z-10 max-h-44 w-full flex flex-row justify-start bg-black/10 px-10 backdrop-blur-6 @container/header dark:bg-gray/[15%] dark:backdrop-blur-6">
      <div class="mt-4">
        <h1 class="text-3xl font-bold">
          Nuxt OIDC Auth
        </h1>
        <p class="mb-4 opacity-50">
          Nuxt DevTools Integration
        </p>
      </div>
      <div class="ml-auto flex flex-col-reverse justify-center gap-2 py-2 @[48rem]/header:flex-row">
        <NDropdown v-model="showLoginDropdown" n="green n-bg-base">
          <template #trigger>
            <NButton
              type="button"
              n="green"
              class="n-bg-base w-28 self-start @[48rem]/header:mt-4"
              @click="showLoginDropdown = !showLoginDropdown"
            >
              <span class="i-carbon-login" />
              Login
            </NButton>
          </template>
          <div class="w-28 flex flex-col gap-2">
            <button
              n="green"
              class="n-bg-base w-full self-start p-2 text-left hover:bg-black/20 dark:hover:bg-white/20"
              :border="false"
              @click="login()"
            >
              Default
            </button>
            <button
              v-for="provider in Object.keys(registeredProviders)" :key="provider"
              n="green"
              class="n-bg-base w-full self-start p-2 text-left hover:bg-black/20 dark:hover:bg-white/20"
              :border="false"
              @click="login(provider)"
            >
              {{ provider.charAt(0).toUpperCase() + provider.slice(1) }}
            </button>
          </div>
        </NDropdown>
        <NDropdown v-model="showLogoutDropdown" n="green n-bg-base" class="ml-auto @[48rem]/header:ml-0">
          <template #trigger>
            <NButton
              type="button"
              n="green"
              class="n-bg-base w-28 self-start @[48rem]/header:mt-4"
              @click="showLogoutDropdown = !showLogoutDropdown"
            >
              <span class="i-carbon-logout" />
              Logout
            </NButton>
          </template>
          <div class="w-28 flex flex-col gap-2">
            <button
              n="green"
              class="n-bg-base w-full self-start p-2 text-left hover:bg-black/20 dark:hover:bg-white/20"
              :border="false"
              @click="logout()"
            >
              Default
            </button>
            <button
              v-for="provider in Object.keys(registeredProviders)" :key="provider"
              n="green"
              class="n-bg-base w-full self-start p-2 text-left hover:bg-black/20 dark:hover:bg-white/20"
              :border="false"
              @click="logout(provider)"
            >
              {{ provider.charAt(0).toUpperCase() + provider.slice(1) }}
            </button>
          </div>
        </NDropdown>
        <NButton
          class="n-bg-base ml-auto w-28 self-start @[48rem]/header:ml-0 @[48rem]/header:mt-4"
          n="green"
          @click="devtoolsClient!.host.devtools.reload()"
        >
          <span class="i-carbon-reset" />
          Reload
        </NButton>
      </div>
    </div>
    <div class="@container/content">
      <NTip
        v-if="!isDevAuthed"
        class="relative mt-33 @[53rem]/content:mt-23"
        n="orange5"
        icon="i-carbon-locked"
        justify-center
      >
        Current DevTools session is not authorized, some features may be disabled.
      </NTip>
      <div
        v-if="oidcConfig"
        class="flex flex-col"
        :class="{ 'mt-33 @[53rem]/content:mt-23': isDevAuthed }"
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
  </div>
</template>
