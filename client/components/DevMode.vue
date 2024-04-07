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
        v-if="oidcRuntimeConfig.devMode.enabled"
        n="lime6 dark:lime5"
        icon="carbon:checkmark-outline"
      >
        DevMode enabled!
      </NTip>
      <NTip
        v-else
        n="yellow6 dark:yellow5"
        icon="carbon:warning"
        class="mb-4"
      >
        Dev Mode is not enabled. To enabled it, set
        <NBadge title="devMode">
          devMode
        </NBadge>
        <NBadge title="enabled">
          enabled
        </NBadge>
        to true.
      </NTip>
      <NBadge
        title="sessionSecret"
        class="text-base"
      >
        Current config:
      </NBadge>
      <NCodeBlock
        v-if="Object.keys(oidcRuntimeConfig?.devMode).length > 0"
        class="overflow-x-scroll"
        lang="JSON"
        :code="JSON.stringify(oidcRuntimeConfig.devMode, null, '\t')"
      />
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
