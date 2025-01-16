<script setup lang="ts">
import { useOidcAuth } from '#build/imports'
import { useRequestURL } from 'nuxt/app'
import { providers } from '../../../providers'

const { login } = useOidcAuth()
</script>

<template>
  <button
    v-for="provider in providers"
    :key="provider"
    :name="provider"
    @click="login(provider as any, { redirectUri: `http://${useRequestURL().host}/auth/${provider}/callback` })"
  >
    {{ provider }} login
  </button>
</template>
