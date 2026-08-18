import type { H3Event } from 'h3'
import { getRequestHeader, getRequestURL } from 'h3'

/**
 * Defense-in-depth CSRF check for state-changing endpoints.
 *
 * Rejects browser requests whose Origin (or Referer) does not match the request target. Requests
 * without an Origin or Referer header (for example server-to-server API clients) are allowed, since
 * the SameSite=Lax session cookie already prevents cross-site browsers from sending credentials.
 */
export function isSameOriginRequest(event: H3Event): boolean {
  const target = getRequestURL(event).origin

  const origin = getRequestHeader(event, 'origin')
  if (origin) return origin === target

  const referer = getRequestHeader(event, 'referer')
  if (referer) {
    try {
      return new URL(referer).origin === target
    } catch {
      return false
    }
  }

  return true
}
