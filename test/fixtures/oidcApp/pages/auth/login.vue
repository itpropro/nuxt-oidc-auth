<script setup lang="ts">
import { useRequestURL } from 'nuxt/app'

import { useOidcAuth } from '#imports'

import { providers } from '../../../providers'

const { login } = useOidcAuth()
</script>

<template>
  <button
    v-for="provider in providers"
    :key="provider"
    type="button"
    :name="provider"
    @click="
      login(provider, {
        redirectUri: `http://${useRequestURL().host}/auth/${provider}/callback`,
      })
    "
  >
    {{ provider }} login
  </button>
</template>
