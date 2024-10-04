<script setup lang="ts">
interface Props {
  src: string
  preset?: string | null
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  alt?: string
  title?: string
}

withDefaults(defineProps<Props>(), {
  fit: 'cover',
  alt: '',
})
</script>

<template>
  <img
    :alt="alt"
    :src="src"
    :preset="preset || null"
    fit="fill"
    class="mb-2 rounded-lg dark:brightness-75 shadow-lg"
  >
  <p v-if="alt || title" class="text-center mt-0 opacity-70">
    {{ title || alt }}
  </p>
</template>
