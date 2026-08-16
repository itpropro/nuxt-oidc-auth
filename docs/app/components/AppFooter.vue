<script setup lang="ts">
const { footer } = useAppConfig()
</script>

<template>
  <UFooter class="border-t border-default">
    <template #left>
      <span class="text-sm text-muted">
        {{ footer.credits }}
      </span>
    </template>

    <template #right>
      <UColorModeButton v-if="footer?.colorMode" />

      <template v-if="footer?.links">
        <UButton
          v-for="(link, index) of footer?.links"
          :key="index"
          v-bind="{ color: 'neutral', variant: 'ghost', ...link }"
        />
      </template>
    </template>
  </UFooter>
</template>
