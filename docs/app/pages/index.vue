<script setup lang="ts">
import { useParallax } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'

const { data: page } = await useAsyncData('index', () => queryContent('/').findOne())

const target = ref(null)
const parallax = reactive(useParallax(target))

useSeoMeta({
  titleTemplate: '',
  title: page.value.title,
  ogTitle: page.value.title,
  description: page.value.description,
  ogDescription: page.value.description,
})

const cardStyle = computed(() => ({
  transition: '.3s ease-out all',
  transform: `rotateX(${parallax.roll * 20}deg) rotateY(${
    parallax.tilt * 20
  }deg)`,
}))

const shadowStyle = computed(() => ({
  transform: `rotateY(${parallax.tilt * 20}deg)`,
  position: 'absolute',
  height: '0',
}))

const browserStyle = computed(() => ({
  transition: '.3s ease-out all',
  transform: `translateX(${parallax.tilt * 10}px) translateY(${
    parallax.roll * 10
  }px)`,
}))
const logoStyle = computed(() => ({
  transition: '.3s ease-out all',
  transform: `translateX(${parallax.tilt * 4}px) translateY(${
    parallax.roll * 4
  }px)`,
}))

const unlocked = ref(false)
</script>

<template>
  <div>
    <ULandingHero
      v-if="page.hero"
      v-bind="page.hero"
    >
      <template #title>
        <div class="leading-tight">
          Nuxt <span class="text-primary">OIDC </span><br>Auth
        </div>
      </template>

      <template #description>
        <p class="tracking-normal">
          Nuxt OIDC Auth provides seamless OpenID Connect compatible authentication for your SSR Nuxt Apps.
          It supports
          <NuxtLink to="/composable#refresh" class="text-[#00dc82] inline-block hover:scale-[103%] transition-transform">
            refresh tokens
          </NuxtLink>
          ,
          <NuxtLink to="/getting-started/security#session-encryption" class="text-[#00dc82] inline-block hover:scale-[103%] transition-transform">
            encrypted sessions
          </NuxtLink>
          , <NuxtLink to="/getting-started/security" class="text-[#00dc82] inline-block hover:scale-[103%] transition-transform">
            PKCE
          </NuxtLink>, tested
          <NuxtLink to="/provider" class="text-[#00dc82] inline-block hover:scale-[103%] transition-transform">
            preconfigured providers
          </NuxtLink> and a lot more.
        </p>
      </template>

      <div>
        <ClientOnly>
          <div class="[perspective:600px] mb-32 group">
            <div ref="target" class="h-48 max-w-64 mx-auto" :style="cardStyle">
              <img alt="browser" :class="unlocked ? 'opacity-100' : 'opacity-40'" class="absolute left-0 top-0 h-full w-full" src="~/assets/browser.svg" :style="browserStyle">
              <img alt="lock-sign" :class="unlocked ? 'opacity-0' : 'opacity-100'" class="absolute left-0 h-32 top-8 w-full" src="~/assets/nuxt-oidc-auth.svg" :style="logoStyle">
              <button name="Browser unlock visual" aria-label="Browser unlock visual" class="absolute w-full h-full" @click="unlocked = !unlocked" />
            </div>
            <div class="transition-all duration-300 ease-out h-2 absolute group-hover:shadow-[0px_70px_32px_4px_rgba(0,220,130,0.75)] shadow-[0px_70px_33px_3px_rgba(0,220,130,0.75)] bottom-0 lg:left-[27.5%] left-[35%] w-[30%] lg:w-[45%] bg-slate-700" :style="shadowStyle" />
          </div>
          <template #fallback>
            <div class="[perspective:600px] mb-32 group">
              <div ref="target" class="h-48 max-w-64 mx-auto">
                <img alt="browser" :class="unlocked ? 'opacity-100' : 'opacity-40'" class="absolute left-0 top-0 h-full w-full" src="~/assets/browser.svg">
                <img alt="lock-sign" :class="unlocked ? 'opacity-0' : 'opacity-100'" class="absolute left-0 h-32 top-8 w-full" src="~/assets/nuxt-oidc-auth.svg">
                <button name="Browser unlock visual" aria-label="Browser unlock visual" class="absolute w-full h-full" @click="unlocked = !unlocked" />
              </div>
            </div>
          </template>
        </ClientOnly>
        <MDC
          :value="page.hero.code"
          class="prose prose-primary dark:prose-invert mx-auto"
        />
      </div>
    </ULandingHero>

    <ULandingSection
      :title="page.features.title"
      :links="page.features.links"
    >
      <UPageGrid>
        <ULandingCard
          v-for="(item, index) of page.features.items"
          :key="index"
          v-bind="item"
        />
      </UPageGrid>
    </ULandingSection>
  </div>
</template>
