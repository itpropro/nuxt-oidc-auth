<script setup lang="ts">
// @ts-expect-error: Nuxt testing imports
import { definePageMeta } from '#build/imports'

definePageMeta({
  oidcAuth: {
    enabled: false,
  },
})
</script>

<template>
  <div name="excluded">
    Excluded page
  </div>
</template>
