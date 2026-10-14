import { joinURL } from 'ufo'

import { defineNuxtPlugin, onNuxtReady, useOidcAuth, useRuntimeConfig } from '#imports'

export default defineNuxtPlugin(() => {
  const { loggedIn, currentProvider, logout, refresh, user } = useOidcAuth()
  const sseUrl = joinURL(useRuntimeConfig().app.baseURL || '/', '/api/_auth/sso')
  let eventSource: EventSource | null = null
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  const retryDelay = 2000
  const maxRetries = 5
  let retryCount = 0

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (retryTimeout !== null) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
  }

  const attemptReconnect = () => {
    if (retryTimeout !== null) {
      return
    }

    if (retryCount >= maxRetries) {
      return
    }

    retryCount++
    retryTimeout = globalThis.setTimeout(connect, retryDelay)
  }

  async function handleLogout(): Promise<void> {
    disconnect()
    await refresh()
    if (loggedIn.value) {
      void logout(currentProvider.value)
    }
  }

  function connect(): void {
    eventSource = new EventSource(sseUrl)

    eventSource.addEventListener('open', () => {
      if (retryTimeout !== null) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
      retryCount = 0
    })

    eventSource.addEventListener('logout', () => {
      void handleLogout()
    })

    eventSource.addEventListener('error', () => {
      if (eventSource?.readyState === EventSource.CLOSED) {
        attemptReconnect()
      }
    })

    globalThis.addEventListener('beforeunload', () => {
      disconnect()
    })
  }

  onNuxtReady(() => {
    if (loggedIn.value && user.value?.singleSignOut === true) {
      connect()
    }
  })
})
