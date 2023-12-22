<script setup lang="ts">
const { user, login } = useOidcAuth()
</script>

<template>
  <div>
    <UPageBody>
      <pre>{{ user }}</pre>
    </UPageBody>
    <UButton @click="login()">
      login
    </UButton>
  </div>
</template>
