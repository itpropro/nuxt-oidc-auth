<script setup lang="ts">
defineProps<{
  oidcSecrets: Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>
}>()
</script>

<template>
  <NSectionBlock
    icon="carbon-password"
    text="Secrets"
    description="Current encryption secrets"
    :padding="false"
    :open="false"
  >
    <div class="space-y-4">
      <p>
        <NBadge
          title="tokenKey"
          n="green"
          class="mr-2"
        >
          NUXT_OIDC_TOKEN_KEY
        </NBadge>
        <code class="font-mono op-50">
          {{ oidcSecrets.tokenKey || 'Not set via. environment, please check your console output for the current value' }}
        </code>
      </p>
      <p>
        <NBadge
          title="sessionSecret"
          n="green"
          class="mr-2"
        >
          NUXT_OIDC_SESSION_SECRET
        </NBadge>
        <code class="font-mono op-50">
          {{ oidcSecrets.sessionSecret || 'Not set via. environment, please check your console output for the current value' }}
        </code>
      </p>
      <p>
        <NBadge
          title="authSessionSecret"
          n="green"
          class="mr-2"
        >
          NUXT_OIDC_AUTH_SESSION_SECRET
        </NBadge>
        <code class="font-mono op-50">
          {{ oidcSecrets.authSessionSecret || 'Not set via. environment, please check your console output for the current value' }}
        </code>
      </p>
      <NTip
        v-if="!oidcSecrets.tokenKey || !oidcSecrets.sessionSecret || !oidcSecrets.authSessionSecret"
        n="yellow6 dark:yellow5"
        icon="carbon:warning"
      >
        If you don't define your secrets, Nuxt OIDC Auth will auto provide them in development, they will change
        on each server restart.
        Check your console for the following output:
        <NCodeBlock
          class="mt-4"
          :code="`[nuxt-oidc-auth]: NUXT_OIDC_TOKEN_KEY=
[nuxt-oidc-auth]: NUXT_OIDC_SESSION_SECRET=
[nuxt-oidc-auth]: NUXT_OIDC_AUTH_SESSION_SECRET=`"
          :lines="false"
        />
      </NTip>
      <p>
        For more information check the <NLink
          n="green"
          href="https://nuxt.com/modules/nuxt-oidc-auth#_3-set-secrets"
          target="_blank"
        >
          docs for setting secrets
        </NLink>
      </p>
    </div>
  </NSectionBlock>
</template>
