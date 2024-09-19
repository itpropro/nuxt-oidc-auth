<script setup lang="ts">
defineProps<{
  oidcState: object
}>()
</script>

<template>
  <NSectionBlock
    icon="carbon-prompt-session"
    text="Auth state"
    description="Current nuxt-oidc-auth session"
    padding="px-6"
    :open="false"
    class="z-0"
  >
    <NCodeBlock
      v-if="Object.keys(oidcState).length > 0"
      class="overflow-x-scroll"
      lang="JSON"
      :code="JSON.stringify(oidcState, null, '\t')"
    />
    <NTip
      v-else
      n="yellow6 dark:yellow5"
      icon="carbon:warning"
    >
      Not authenticated
    </NTip>
  </NSectionBlock>
</template>
