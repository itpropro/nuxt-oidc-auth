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
  if (origin !== undefined && origin.length > 0) {
    return origin === target
  }

  const referer = getRequestHeader(event, 'referer')
  if (referer !== undefined && referer.length > 0) {
    try {
      return new URL(referer).origin === target
    } catch {
      return false
    }
  }

  return true
}

/**
 * CSRF check for state-changing top-level navigations, which carry the SameSite=Lax session cookie.
 *
 * Allows only Fetch Metadata `same-origin` and `none` (typed URL or bookmark). Browsers keep the
 * value of the least trusted origin across a redirect chain, so same-origin route-rule redirects
 * stay allowed. Sibling subdomains (`same-site`) are rejected. Requests without the header, from
 * older browsers or non-browser clients, are allowed.
 */
export function isSameOriginNavigation(event: H3Event): boolean {
  const site = getRequestHeader(event, 'sec-fetch-site')
  return site === undefined || site === 'same-origin' || site === 'none'
}

/**
 * Whether a request may start, complete or discard a login. The login transaction cookie uses
 * SameSite=None for cross-site form_post callbacks, so subresource and frame requests from other
 * sites must not replace or delete it. Top-level navigations from anywhere, same-origin requests and
 * requests without Fetch Metadata are allowed.
 */
export function canChangeLoginTransaction(event: H3Event): boolean {
  const site = getRequestHeader(event, 'sec-fetch-site')
  const destination = getRequestHeader(event, 'sec-fetch-dest')
  return (
    site === undefined ||
    site === 'same-origin' ||
    site === 'none' ||
    destination === undefined ||
    destination === 'document'
  )
}
