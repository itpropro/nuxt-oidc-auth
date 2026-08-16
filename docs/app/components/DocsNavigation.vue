<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

defineOptions({ name: 'DocsNavigation' })

defineProps<{
  navigation: ContentNavigationItem[]
  nested?: boolean
}>()
</script>

<template>
  <ul :class="nested ? 'mt-1 ml-3 border-l border-default pl-3' : 'space-y-1'">
    <li v-for="link in navigation" :key="link.path || link.title">
      <ULink
        v-if="link.path && !link.children?.length"
        :to="link.path"
        class="flex items-center gap-2 py-1.5 text-sm text-muted hover:text-highlighted"
        active-class="font-medium text-primary"
      >
        <UIcon v-if="link.icon" :name="link.icon" class="size-4 shrink-0" />
        <span>{{ link.title }}</span>
      </ULink>
      <span v-else class="flex items-center gap-2 py-1.5 text-sm font-medium text-highlighted">
        <UIcon v-if="link.icon" :name="link.icon" class="size-4 shrink-0" />
        {{ link.title }}
      </span>

      <DocsNavigation
        v-if="link.children?.length"
        :navigation="link.children"
        nested
      />
    </li>
  </ul>
</template>
