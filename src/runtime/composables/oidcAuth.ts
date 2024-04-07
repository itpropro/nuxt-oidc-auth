import { useState, computed, useRequestFetch, navigateTo } from '#imports'
import type { Ref, ComputedRef } from '#imports'
import type { ProviderKeys } from '../types/oidc'
import type { UserSession } from '../types/session'

const useSessionState = () => useState<UserSession>('nuxt-oidc-auth-session', undefined)

export const useOidcAuth = () => {
  const sessionState: Ref<UserSession> = useSessionState()
  const user: ComputedRef<UserSession> = computed(() => sessionState.value || undefined)
  const loggedIn: ComputedRef<boolean> = computed<boolean>(() => {
    return Boolean(sessionState.value)
  })
  const currentProvider: ComputedRef<ProviderKeys | undefined | 'dev'> = computed(() => sessionState.value?.provider || undefined)
  async function fetch() {
    useSessionState().value = (await useRequestFetch()('/api/_auth/session', {
      headers: {
        Accept: 'text/json'
      }
    }).catch(() => (undefined)) as UserSession)
  }

  async function refresh() {
    await $fetch('/api/_auth/refresh', { method: 'POST' })
    await fetch()
  }

  async function login(provider?: ProviderKeys | 'dev') {
    await navigateTo(`/auth${provider ? '/' + provider : ''}/login`, { external: true, redirectCode: 302 })
  }

  async function logout(provider?: ProviderKeys | 'dev') {
    await navigateTo(`/auth${provider ? '/' + provider : ''}/logout`, { external: true })
  }

  /**
  * Clears the current user session. Mainly for debugging, in production, always use the `logout` function, which completely cleans the state.
  */
  async function clear() {
    await useRequestFetch()('/api/_auth/session', {
      method: 'DELETE',
      headers: {
        Accept: 'text/json'
      }
    })
  }

  return {
    loggedIn,
    user,
    currentProvider,
    fetch,
    refresh,
    login,
    logout,
    clear,
  }
}
