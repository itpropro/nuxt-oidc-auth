import { useState, computed, useRequestFetch, navigateTo } from '#imports'
import type { Ref, ComputedRef } from '#imports'
import type { ProviderKeys } from '../types/oidc'
import type { UserSession } from '../types/session'

const useSessionState = () => useState<UserSession>('nuxt-session', () => ({}))

export const useOidcAuth = () => {
  const sessionState: Ref<UserSession> = useSessionState()
  const user: ComputedRef<UserSession> = computed(() => sessionState.value || {})
  const loggedIn: ComputedRef<boolean> = computed<boolean>(() => {
    fetch()
    return Boolean(sessionState.value.loggedInAt)
  })
  const currentProvider: ComputedRef<ProviderKeys | undefined | 'dev'> = computed(() => sessionState.value.provider || undefined)
  async function fetch() {
    useSessionState().value = (await useRequestFetch()('/api/_auth/session', {
      headers: {
        Accept: 'text/json'
      }
    }).catch(() => ({})) as UserSession)
  }

  async function refresh() {
    await $fetch('/api/_auth/refresh', { method: 'POST' })
    await fetch()
  }

  async function login(provider?: ProviderKeys) {
    await navigateTo(`/auth${provider ? '/' + provider : ''}/login`, { external: true, redirectCode: 302 })
  }

  async function logout(provider?: ProviderKeys) {
    await navigateTo(`/auth${provider ? '/' + provider : ''}/logout`, { external: true })
  }

  return {
    loggedIn,
    user,
    currentProvider,
    fetch,
    refresh,
    login,
    logout,
  }
}
