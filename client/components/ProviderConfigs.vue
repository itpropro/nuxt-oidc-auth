<script setup lang="ts">
import type { OidcConfig } from '../pages/index.vue'
import { computed } from 'vue'

const props = defineProps<{
  oidcConfig: OidcConfig
}>()

const model = defineModel({ type: String, default: '' })
const configJson = computed(() =>
  JSON.stringify(props.oidcConfig.providers[model.value], null, '\t'),
)
</script>

<template>
  <NSectionBlock
    icon="carbon-document-multiple-01"
    text="Provider configs"
    description="Resolved provider configuration with sensitive values redacted"
    padding="px-6"
    :open="false"
    class="z-0"
  >
    <div class="w-full flex justify-start gap-3">
      <NSelect
        v-model="model"
        n="lime6 dark:lime5"
        placeholder="Select a provider"
      >
        <option
          v-for="(value, key) in oidcConfig.providers"
          :key="key"
          :value="key"
        >
          {{ key.charAt(0).toUpperCase() + key.slice(1) }}
        </option>
      </NSelect>
    </div>
    <NCodeBlock
      v-if="model"
      class="overflow-x-auto"
      lang="json"
      :code="configJson"
    />
  </NSectionBlock>
</template>
