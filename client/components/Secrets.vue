<script setup lang="ts">
defineProps<{
  oidcSecrets: Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>
  available: boolean
}>()
</script>

<template>
  <NSectionBlock
    icon="carbon-password"
    text="Secrets"
    description="Current encryption secrets"
    padding="px-6"
    :open="false"
    class="z-0"
  >
    <div class="space-y-4">
      <template v-if="available">
        <p>
          <NBadge title="tokenKey" n="green" class="mr-2"> NUXT_OIDC_TOKEN_KEY </NBadge>
          <code class="font-mono op-50">{{ oidcSecrets.tokenKey || 'Not set' }}</code>
        </p>
        <p>
          <NBadge title="sessionSecret" n="green" class="mr-2"> NUXT_OIDC_SESSION_SECRET </NBadge>
          <code class="font-mono op-50">{{ oidcSecrets.sessionSecret || 'Not set' }}</code>
        </p>
        <p>
          <NBadge title="authSessionSecret" n="green" class="mr-2">
            NUXT_OIDC_AUTH_SESSION_SECRET
          </NBadge>
          <code class="font-mono op-50">{{ oidcSecrets.authSessionSecret || 'Not set' }}</code>
        </p>
        <NTip n="yellow6 dark:yellow5" icon="carbon:warning">
          Secrets you don't define are generated when the dev server starts and change when the dev
          server process restarts. The console only prints a five-character prefix of each generated
          value to help you recognise it.
        </NTip>
      </template>
      <NTip v-else n="yellow6 dark:yellow5" icon="carbon:locked">
        Secrets are only shown in an authorized DevTools session on the dev server with
        <code>devMode.enabled</code> and Nuxt DevTools authorization enabled. The console only
        prints a five-character prefix of each generated value.
      </NTip>
      <p>
        For more information check the
        <NLink
          n="green"
          href="https://nuxt.com/modules/nuxt-oidc-auth#_3-set-secrets"
          target="_blank"
          rel="noopener noreferrer"
        >
          docs for setting secrets
        </NLink>
      </p>
    </div>
  </NSectionBlock>
</template>
