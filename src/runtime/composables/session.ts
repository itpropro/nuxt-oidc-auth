import { useState, computed, useRequestFetch } from '#imports'
import type { UserSession } from '#oidc-auth'

const useSessionState = () => useState<UserSession>('nuxt-session', () => ({}))

export const useUserSession = () => {
  const sessionState = useSessionState()
  return {
    loggedIn: computed(() => Boolean(sessionState.value.loggedInAt)),
    user: computed(() => sessionState.value || null),
    session: sessionState,
    fetch,
    clear,
    refresh
  }
}

async function fetch() {
  useSessionState().value = await useRequestFetch()('/api/_auth/session', {
    headers: {
      Accept: 'text/json'
    }
  }).catch(() => ({}))
}

async function clear() {
  await $fetch('/api/_auth/session', { method: 'DELETE' })
  useSessionState().value = {}
}

async function refresh() {
  await $fetch('/api/_auth/refresh', { method: 'POST' })
  await fetch()
}
