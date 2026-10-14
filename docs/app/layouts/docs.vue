<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import type { VNode } from 'vue'

defineSlots<{ default: () => VNode[] }>()

const navigation = inject<Ref<ContentNavigationItem[] | null>>('navigation')
</script>

<template>
  <UContainer>
    <UPage>
      <template #left>
        <UPageAside>
          <nav aria-label="Documentation">
            <DocsNavigation :navigation="navigation || []" />
          </nav>
        </UPageAside>
      </template>

      <slot />
    </UPage>
  </UContainer>
</template>
