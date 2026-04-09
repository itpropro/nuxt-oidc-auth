<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  oidcAuth: {
    enabled: false,
  },
})
</script>

<template>
  <div name="excluded">Excluded page</div>
</template>
