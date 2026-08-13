<script setup lang="ts">
import { useOidcAuth } from '#imports'

const { refresh, fetch, logout, clear, user, currentProvider, loggedIn } = useOidcAuth()
</script>

<template>
  <div name="currentProvider">
    {{ currentProvider }}
  </div>
  <div name="canRefresh">
    {{ user?.canRefresh }}
  </div>
  <div name="updatedAt">
    {{ user?.updatedAt }}
  </div>
  <div name="expireAt">
    {{ user?.expireAt }}
  </div>
  <div name="singleSignOut">
    {{ user?.singleSignOut }}
  </div>
  <div name="userName">
    {{ user?.userName }}
  </div>
  <div name="claims">
    {{ JSON.stringify(user?.claims) }}
  </div>
  <div name="userInfo">
    {{ JSON.stringify(user?.userInfo) }}
  </div>
  <div name="loggedIn">
    {{ loggedIn }}
  </div>
  <button name="logout" @click="logout()">Logout</button>
  <button name="refresh" @click="refresh()">Refresh</button>
  <button name="clear" @click="clear()">Clear</button>
  <button name="fetch" @click="fetch()">Fetch</button>
</template>
