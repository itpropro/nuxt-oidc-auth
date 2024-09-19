<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OidcConfig } from '../pages/index.vue'

const props = defineProps<{
  oidcConfig: OidcConfig
  oidcRuntimeConfig: OidcConfig
}>()

const model = defineModel({ type: String, default: '' })
const configType = ref('runtime')
const configJson = computed(() => {
  if (configType.value === 'runtime') {
    return JSON.stringify(props.oidcRuntimeConfig.providers[model.value], null, '\t')
  }
  return JSON.stringify(props.oidcConfig.providers[model.value], null, '\t')
})
</script>

<template>
  <NSectionBlock
    icon="carbon-document-multiple-01"
    text="Provider configs"
    description="Currently configured authentication providers"
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
      <form class="flex items-center gap-3">
        <NRadio
          v-model="configType"
          n="green6 dark:green5"
          name="runtime"
          value="runtime"
        >
          Runtime config
        </NRadio>
        <NRadio
          v-model="configType"
          n="green6 dark:green5"
          name="server"
          value="server"
        >
          Server config
        </NRadio>
      </form>
    </div>
    <NCodeBlock
      v-if="model"
      class="overflow-x-auto"
      lang="JSON"
      :code="configJson"
    />
  </NSectionBlock>
</template>
