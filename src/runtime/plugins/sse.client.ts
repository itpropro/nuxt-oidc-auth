import { defineNuxtPlugin, onNuxtReady, useOidcAuth } from '#imports'

export default defineNuxtPlugin(() => {
  const { loggedIn, currentProvider, logout, refresh } = useOidcAuth()
  const sseUrl = '/sse'
  let eventSource: EventSource | null = null
  let retryTimeout: number | null = null
  const retryDelay = 2000
  const maxRetries = 5
  let retryCount = 0

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
  }

  const connect = () => {
    const attemptReconnect = () => {
      if (retryTimeout)
        return

      if (retryCount >= maxRetries) {
        return
      }

      retryCount++
      retryTimeout = window.setTimeout(connect, retryDelay)
    }

    eventSource = new EventSource(sseUrl)

    eventSource.onopen = () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
      retryCount = 0
    }

    eventSource.addEventListener('logout', async () => {
      disconnect()
      await refresh()
      if (loggedIn.value) {
        logout(currentProvider.value)
      }
    })

    eventSource.onerror = () => {
      if (eventSource?.readyState === EventSource.CLOSED) {
        attemptReconnect()
      }
    }

    window.addEventListener('beforeunload', () => {
      disconnect()
    })
  }

  onNuxtReady(() => {
    if (loggedIn.value) {
      connect()
    }
  })
})
