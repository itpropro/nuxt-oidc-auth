<script setup lang="ts">
const { seo } = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('docs'))
const { data: files } = await useAsyncData('search-sections', () => queryCollectionSearchSections('docs', {
  ignoredTags: ['style'],
}))

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  link: [
    { rel: 'icon', href: '/favicon.svg' },
  ],
  htmlAttrs: {
    lang: 'en',
  },
})

useSeoMeta({
  titleTemplate: `%s - ${seo?.siteName}`,
  ogSiteName: seo?.siteName,
  ogImage: 'https://nuxtoidc.cloud/social-card.png',
  twitterImage: 'https://nuxtoidc.cloud/social-card.png',
  twitterCard: 'summary_large_image',
})

provide('navigation', navigation)
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
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
