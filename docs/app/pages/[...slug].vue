<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { findPageHeadline } from '@nuxt/content/utils'
import ShikiStyle from '~/components/ShikiStyle'

definePageMeta({
  layout: 'docs',
})

const route = useRoute()
const { toc, seo } = useAppConfig()
const navigation = inject<Ref<ContentNavigationItem[] | null>>('navigation')

const { data: pageData } = await useAsyncData(route.path, () => queryCollection('docs').path(route.path).first())
if (!pageData.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const page = pageData.value

const { data: surround } = await useAsyncData(`${route.path}-surround`, () => queryCollectionItemSurroundings('docs', route.path, {
  fields: ['description'],
}))

useSeoMeta({
  title: page.title,
  ogTitle: `${page.title} - ${seo?.siteName}`,
  description: page.description,
  ogDescription: page.description,
})

defineOgImage('NuxtOidcAuth', {
  title: page.title,
  description: page.description,
})

const headline = computed(() => findPageHeadline(navigation?.value || undefined, page.path))

const links = computed(() => toc?.bottom?.links || [])
</script>

<template>
  <UPage>
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :headline="headline"
    />

    <UPageBody>
      <ContentRenderer
        v-if="page.body"
        :value="page"
        :components="{ style: ShikiStyle }"
      />

      <hr v-if="surround?.length">

      <UContentSurround :surround="surround" />
    </UPageBody>

    <template
      v-if="page.body?.toc?.links?.length"
      #right
    >
      <ClientOnly>
        <UContentToc
          :title="toc?.title"
          :links="page.body?.toc?.links"
        >
          <template
            v-if="toc?.bottom"
            #bottom
          >
            <div
              class="hidden lg:block space-y-6"
              :class="{ '!mt-6': page.body?.toc?.links?.length }"
            >
              <USeparator
                v-if="page.body?.toc?.links?.length"
                type="dashed"
              />

              <UPageLinks
                :title="toc.bottom.title"
                :links="links"
              />
            </div>
          </template>
        </UContentToc>
      </ClientOnly>
    </template>
  </UPage>
</template>
