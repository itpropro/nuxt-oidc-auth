<script setup lang="ts">
import type { OidcConfig } from '../pages/index.vue'

defineProps<{
  oidcRuntimeConfig: OidcConfig
}>()
</script>

<template>
  <NSectionBlock
    icon="carbon-code"
    text="DevMode"
    description="Dev Mode Insights"
    :padding="false"
    :open="false"
  >
    <div class="space-y-4">
      <NTip
        v-if="!oidcRuntimeConfig.devMode.enabled || oidcRuntimeConfig.session.expirationCheck"
        n="yellow6 dark:yellow5"
        icon="carbon:warning"
      >
        Either
        <NBadge title="expirationCheck">
          expirationCheck
        </NBadge>
        is not disabled or
        <NBadge title="devMode">
          devMode
        </NBadge>
        is not enabled. DevMode will not work!
      </NTip>
      <NTip
        v-else
        n="lime6 dark:lime5"
        icon="carbon:checkmark-outline"
      >
        DevMode enabled!
      </NTip>
      <p>
        For more information check the <NLink
          n="green"
          href="https://nuxt.com/modules/nuxt-oidc-auth#dev-mode"
          target="_blank"
        >
          docs for dev mode
        </NLink>
      </p>
    </div>
  </NSectionBlock>
</template>
