import { useState, computed, useRequestFetch, navigateTo } from '#imports'
import type { UserSession } from '#oidc-auth'

const useSessionState = () => useState<UserSession>('nuxt-session', () => ({}))

export const useOidcAuth = () => {
  const sessionState = useSessionState()
  return {
    loggedIn: computed(() => Boolean(sessionState.value.loggedInAt)),
    user: computed(() => sessionState.value || null),
    fetch,
    refresh,
    login,
    logout,
  }
}

async function fetch() {
  useSessionState().value = await useRequestFetch()('/api/_auth/session', {
    headers: {
      Accept: 'text/json'
    }
  }).catch(() => ({}))
}

async function refresh() {
  await $fetch('/api/_auth/refresh', { method: 'POST' })
  await fetch()
}

async function login(provider?: string) {
  navigateTo(`/auth${provider ? '/' + provider : ''}/login`, { external: true, redirectCode: 302 })
}

async function logout(provider?: string) {
  navigateTo(`/auth${provider ? '/' + provider : ''}/logout`, { external: true })
}
