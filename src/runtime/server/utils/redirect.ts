interface ResolveCallbackRedirectUrlOptions {
  configuredCallbackRedirectUrl?: string
  hasConfiguredCallbackRedirectUrl: boolean
  sessionCallbackRedirectUrl?: string
}

export function sanitizeCallbackRedirectUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    return undefined
  }
  return value
}

export function resolveCallbackRedirectUrl({
  configuredCallbackRedirectUrl,
  hasConfiguredCallbackRedirectUrl,
  sessionCallbackRedirectUrl,
}: ResolveCallbackRedirectUrlOptions): string {
  if (hasConfiguredCallbackRedirectUrl && configuredCallbackRedirectUrl) {
    return configuredCallbackRedirectUrl
  }

  return sanitizeCallbackRedirectUrl(sessionCallbackRedirectUrl) || configuredCallbackRedirectUrl || '/'
}
