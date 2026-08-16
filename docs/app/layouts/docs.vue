<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

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
