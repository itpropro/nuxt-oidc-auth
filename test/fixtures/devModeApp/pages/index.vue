<template>
  <div>
    <p>Dev Mode Test App</p>
    <p data-testid="logged-in">{{ loggedIn }}</p>
    <p data-testid="provider">{{ user?.provider }}</p>
  </div>
</template>

<script setup lang="ts">
import { useOidcAuth } from '#imports'

const { loggedIn, user } = useOidcAuth()
</script>
