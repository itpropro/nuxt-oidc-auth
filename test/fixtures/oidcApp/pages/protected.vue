<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  middleware: 'oidc-auth',
})
</script>

<template>
  <div name="protected">Protected page</div>
</template>
