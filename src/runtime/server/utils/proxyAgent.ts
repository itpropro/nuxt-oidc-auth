import { ofetch } from 'ofetch'
import type * as Undici from 'undici'

export async function getUndiciModule(): Promise<typeof Undici | null> {
  try {
    const undici = await import('undici')
    return undici
  } catch {
    console.warn("Optional dependency 'undici' is not installed.")
    return null
  }
}

/**
 * A fetch function that sends requests through the proxy. Node's built-in fetch rejects dispatchers
 * of other undici versions, so it uses the fetch of the installed undici module.
 */
export async function getProxyFetch(
  proxyUrl: string,
  ignoreProxyCertificateErrors = false,
): Promise<typeof fetch> {
  const undici = await getUndiciModule()
  if (!undici) {
    throw new Error('Cannot create ProxyAgent, undici module is missing.')
  }
  const dispatcher = ignoreProxyCertificateErrors
    ? new undici.ProxyAgent({ uri: proxyUrl, requestTls: { rejectUnauthorized: false } })
    : new undici.ProxyAgent({ uri: proxyUrl })
  return async (input, init) => {
    // undici's fetch does not recognize request bodies of Node's bundled undici, such as FormData,
    // so the built-in Request serializes the request first.
    const request = new Request(input, init)
    const response = await undici.fetch(request.url, {
      body: request.body === null ? undefined : await request.arrayBuffer(),
      dispatcher,
      headers: Array.from(request.headers),
      method: request.method,
      redirect: request.redirect,
      signal: request.signal,
    })
    return new Response(response.body === null ? null : await response.arrayBuffer(), {
      headers: Array.from(response.headers),
      status: response.status,
      statusText: response.statusText,
    })
  }
}

export async function getProxyAgentOfetch(
  proxyUrl: string,
  ignoreProxyCertificateErrors = false,
): Promise<typeof ofetch> {
  return ofetch.create({}, { fetch: await getProxyFetch(proxyUrl, ignoreProxyCertificateErrors) })
}
