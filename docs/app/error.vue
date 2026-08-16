<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps({
  error: {
    type: Object as PropType<NuxtError>,
    required: true,
  },
})

useSeoMeta({
  title: 'Page not found',
  description: 'We are sorry but this page could not be found.',
})

useHead({
  htmlAttrs: {
    lang: 'en',
  },
})

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('docs', [
  'to',
  'external',
  'target',
]))
const { data: files } = await useAsyncData('search-sections', () => queryCollectionSearchSections('docs', {
  ignoredTags: ['style'],
}))

provide('navigation', navigation)
</script>

<template>
  <UApp>
    <AppHeader />

    <UMain>
      <UContainer>
        <UError :error="error" />
      </UContainer>
    </UMain>

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch
        title="Search documentation"
        description="Find a documentation page"
        :files="files || []"
        :navigation="navigation || []"
      />
    </ClientOnly>
  </UApp>
</template>
