<script setup lang="ts">
import type { NavItem } from '@nuxt/content'

const navigation = inject<NavItem[]>('navigation', [])

const { header } = useAppConfig()
const { data } = await useFetch('https://ungh.cc/repos/itpropro/nuxt-oidc-auth/releases/latest', {
  key: 'ghrelease',
})
const currentVersion = computed(() => data.value?.release?.tag || 'v0.19.0')
</script>

<template>
  <UHeader>
    <template #logo>
      <div class="flex gap-3 items-center">
        <img src="~/assets/nuxt-oidc-auth.png" class="w-auto h-8 dark:hidden">
        <img src="~/assets/nuxt-oidc-auth-dark.png" class="w-auto h-8 hidden dark:block">
        <span class="hidden sm:block">
          Nuxt OIDC Auth
        </span>
        <button
          @click="navigateTo(`https://github.com/itpropro/nuxt-oidc-auth/releases/tag/${currentVersion}`, { external: true })"
        >
          <UBadge
            variant="subtle"
            size="xs"
            class="rounded font-semibold truncate hidden sm:inline-flex"
          >
            {{ currentVersion }}
          </UBadge>
        </button>
      </div>
    </template>

    <template
      v-if="header?.search"
      #center
    >
      <UContentSearchButton class="hidden lg:flex" />
    </template>

    <template #right>
      <UContentSearchButton
        v-if="header?.search"
        :label="null"
        class="lg:hidden"
      />
      <UColorModeButton v-if="header?.colorMode" />

      <template v-if="header?.links">
        <UButton
          v-for="(link, index) of header.links"
          :key="index"
          v-bind="{ color: 'gray', variant: 'ghost', ...link }"
        />
      </template>
    </template>

    <template #panel>
      <UNavigationTree :links="mapContentNavigation(navigation)" />
    </template>
  </UHeader>
</template>
