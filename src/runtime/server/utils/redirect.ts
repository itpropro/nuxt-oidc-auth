import { useRuntimeConfig } from '#imports'
import { withBase, withTrailingSlash } from 'ufo'

interface ResolveCallbackRedirectUrlOptions {
  configuredCallbackRedirectUrl?: string
  hasConfiguredCallbackRedirectUrl: boolean
  sessionCallbackRedirectUrl?: string
}

export function sanitizeCallbackRedirectUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\t') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return undefined
  }
  return value
}

export function withAppBase(path: string, baseURL?: string): string {
  const resolvedPath = withBase(path, baseURL ?? useRuntimeConfig().app?.baseURL ?? '/')
  return path === '/' ? withTrailingSlash(resolvedPath) : resolvedPath
}

export function resolveCallbackRedirectUrl({
  configuredCallbackRedirectUrl,
  hasConfiguredCallbackRedirectUrl,
  sessionCallbackRedirectUrl,
}: ResolveCallbackRedirectUrlOptions): string {
  const sanitizedConfiguredRedirectUrl = sanitizeCallbackRedirectUrl(configuredCallbackRedirectUrl)
  if (hasConfiguredCallbackRedirectUrl) {
    return sanitizedConfiguredRedirectUrl || '/'
  }

  return (
    sanitizeCallbackRedirectUrl(sessionCallbackRedirectUrl) || sanitizedConfiguredRedirectUrl || '/'
  )
}
