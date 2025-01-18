import type { ComputedRef } from '#imports'
import type { ProviderKeys, UserSession } from '../types'
import { computed, navigateTo, useRequestEvent, useRequestFetch, useState } from '#imports'
import { appendResponseHeader } from 'h3'

export function useOidcAuth() {
  const sessionState = useState<UserSession>('nuxt-oidc-auth-session', undefined)
  const user: ComputedRef<UserSession | undefined> = computed(() => sessionState.value ?? undefined)
  const loggedIn: ComputedRef<boolean> = computed<boolean>(() => {
    return Boolean(sessionState.value?.expireAt)
  })
  const currentProvider: ComputedRef<ProviderKeys | undefined | 'dev'> = computed(() => sessionState.value?.provider || undefined)
  const serverEvent = import.meta.server ? useRequestEvent() : null

  async function fetch() {
    sessionState.value = (await useRequestFetch()('/api/_auth/session', {
      headers: {
        Accept: 'text/json',
      },
    }).catch(() => (undefined)) as UserSession)
  }

  /**
   * Manually refreshes the authentication session.
   *
   * @returns {Promise<void>}
   */
  async function refresh(): Promise<void> {
    const currentProvider = sessionState.value?.provider || undefined
    sessionState.value = (await useRequestFetch()('/api/_auth/refresh', {
      headers: {
        Accept: 'text/json',
      },
      method: 'POST',
    }).catch(() => login()) as UserSession)
    if (!loggedIn.value) {
      await logout(currentProvider)
    }
  }

  /**
   * Signs in the user by navigating to the appropriate sign-in URL.
   *
   * @param {ProviderKeys | 'dev'} [provider] - The authentication provider to use. If not specified, uses the default provider.
   * @param {Record<string, string>} [params] - Additional parameters to include in the login request. Each parameters has to be listed in 'allowedClientAuthParameters' in the provider configuration.
   * @returns {Promise<void>}
   */
  async function login(provider?: ProviderKeys | 'dev', params?: Record<string, string>): Promise<void> {
    const queryParams = params ? `?${new URLSearchParams(params).toString()}` : ''
    await navigateTo(`/auth${provider ? `/${provider}` : ''}/login${queryParams}`, { external: true, redirectCode: 302 })
  }

  /**
   * Logs out the user by navigating to the appropriate logout URL.
   *
   * @param {ProviderKeys | 'dev'} [provider] - The provider key or 'dev' for development. If provided, the user will be logged out from the specified provider.
   * @param {string} [logoutRedirectUri] - The URI to redirect to after logout if 'logoutRedirectParameterName' is set. If not provided, the user will be redirected to the root site.
   * @returns {Promise<void>}
   */
  async function logout(provider?: ProviderKeys | 'dev', logoutRedirectUri?: string): Promise<void> {
    await navigateTo(`/auth${provider ? `/${provider}` : currentProvider.value ? `/${currentProvider.value}` : ''}/logout${logoutRedirectUri ? `?logout_redirect_uri=${logoutRedirectUri}` : ''}`, { external: true, redirectCode: 302 })
    if (sessionState.value) {
      sessionState.value = undefined as unknown as UserSession
    }
  }

  /**
   * Clears the current user session. Mainly for debugging, in production, always use the `logout` function, which completely cleans the state.
   */
  async function clear() {
    await useRequestFetch()(('/api/_auth/session'), {
      method: 'DELETE',
      headers: {
        Accept: 'text/json',
      },
      onResponse({ response: { headers } }: { response: { headers: Headers } }) {
        // See https://github.com/atinux/nuxt-auth-utils/blob/main/src/runtime/app/composables/session.ts
        // Forward the Set-Cookie header to the main server event
        if (import.meta.server && serverEvent) {
          for (const setCookie of headers.getSetCookie()) {
            appendResponseHeader(serverEvent, 'Set-Cookie', setCookie)
          }
        }
      },
    })
    if (sessionState.value) {
      sessionState.value = undefined as unknown as UserSession
    }
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
