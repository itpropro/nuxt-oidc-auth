import { appendResponseHeader } from 'h3'
import { navigateTo, useRequestEvent, useRequestFetch, useRuntimeConfig, useState } from 'nuxt/app'
import { withBase, withQuery } from 'ufo'
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import type { ProviderKeys, UserSession } from '../types'

interface OidcAuth {
  loggedIn: ComputedRef<boolean>
  user: ComputedRef<UserSession | undefined>
  currentProvider: ComputedRef<ProviderKeys | 'dev' | undefined>
  fetch: () => Promise<void>
  refresh: () => Promise<void>
  login: (provider?: ProviderKeys | 'dev', params?: Record<string, string>) => Promise<void>
  logout: (provider?: ProviderKeys | 'dev', logoutRedirectUri?: string) => Promise<void>
  clear: () => Promise<void>
}

/**
 * Signs in the user by navigating to the appropriate sign-in URL.
 *
 * @param {ProviderKeys | 'dev'} [provider] - The authentication provider to use. If not specified, uses the default provider.
 * @param {Record<string, string>} [params] - Additional parameters to include in the login request. Each parameters has to be listed in 'allowedClientAuthParameters' in the provider configuration.
 * @returns {Promise<void>}
 */
async function login(
  provider?: ProviderKeys | 'dev',
  params?: Record<string, string>,
): Promise<void> {
  const baseURL = useRuntimeConfig().app.baseURL || '/'
  const queryParams = params === undefined ? '' : `?${new URLSearchParams(params).toString()}`
  const loginPath = `/auth${provider === undefined ? '' : `/${provider}`}/login${queryParams}`
  await navigateTo(withBase(loginPath, baseURL), { external: true, redirectCode: 302 })
}

function isProviderUnavailableResponse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 503
  )
}

export function useOidcAuth(): OidcAuth {
  const sessionState = useState<UserSession | undefined>('nuxt-oidc-auth-session')
  const user = computed(() => sessionState.value)
  const loggedIn: ComputedRef<boolean> = computed<boolean>(() => {
    return Boolean(sessionState.value?.expireAt)
  })
  const currentProvider: ComputedRef<ProviderKeys | undefined | 'dev'> = computed(
    () => sessionState.value?.provider,
  )
  const serverEvent = import.meta.server ? useRequestEvent() : null

  async function fetch(): Promise<void> {
    try {
      sessionState.value = await useRequestFetch()<UserSession>('/api/_auth/session', {
        headers: {
          Accept: 'text/json',
        },
      })
    } catch {
      sessionState.value = undefined
    }
  }

  /**
   * Manually refreshes the authentication session.
   * Rejects with the HTTP 503 response error and keeps the session state when the provider does
   * not answer the refresh.
   *
   * @returns {Promise<void>}
   */
  async function refresh(): Promise<void> {
    const provider = sessionState.value?.provider
    try {
      sessionState.value = await useRequestFetch()<UserSession>('/api/_auth/refresh', {
        headers: {
          Accept: 'text/json',
        },
        method: 'POST',
      })
    } catch (error) {
      // The server keeps the session while the provider is unavailable.
      if (isProviderUnavailableResponse(error)) {
        throw error
      }
      await login()
      sessionState.value = undefined
    }
    if (!loggedIn.value) {
      await logout(provider)
    }
  }

  /**
   * Logs out the user by navigating to the appropriate logout URL.
   *
   * @param {ProviderKeys | 'dev'} [provider] - The provider key or 'dev' for development. If provided, the user will be logged out from the specified provider.
   * @param {string} [logoutRedirectUri] - The URI to redirect to after logout if 'logoutRedirectParameterName' is set. If not provided, the user will be redirected to the root site.
   * @returns {Promise<void>}
   */
  async function logout(
    provider?: ProviderKeys | 'dev',
    logoutRedirectUri?: string,
  ): Promise<void> {
    const baseURL = useRuntimeConfig().app.baseURL || '/'
    const logoutProvider = provider ?? currentProvider.value
    const logoutPath = withQuery(
      `/auth${logoutProvider === undefined ? '' : `/${logoutProvider}`}/logout`,
      { ...(logoutRedirectUri !== undefined && logoutRedirectUri !== '' && { logoutRedirectUri }) },
    )
    await navigateTo(withBase(logoutPath, baseURL), { external: true, redirectCode: 302 })
    sessionState.value = undefined
  }

  /**
   * Clears the current user session. Mainly for debugging, in production, always use the `logout` function, which completely cleans the state.
   */
  async function clear(): Promise<void> {
    await useRequestFetch()('/api/_auth/session', {
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
    sessionState.value = undefined
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
