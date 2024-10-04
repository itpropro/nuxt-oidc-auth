<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center text-center bg-slate-900 p-8">
    <img src="/content/nuxt-oidc-auth.png" class="absolute right-18 top-18 size-40">
    <div class="relative pl-10">
      <p class="text-2xl text-white leading-tight font-bold">
        Nuxt <span class="text-[#00dc82]">OIDC</span> Auth
      </p>
      <h1 class="text-8xl mb-6 text-white">
        {{ title }}
      </h1>
      <p class="text-left text-5xl text-gray-200 leading-tight max-w-[75%]">
        {{ description }}
      </p>
    </div>
  </div>
</template>
