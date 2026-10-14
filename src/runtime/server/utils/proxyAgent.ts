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

export async function getProxyAgentOfetch(
  proxyUrl: string,
  ignoreProxyCertificateErrors = false,
): Promise<typeof ofetch> {
  const undici = await getUndiciModule()
  if (!undici) {
    throw new Error('Cannot create ProxyAgent, undici module is missing.')
  }
  const proxyAgent = ignoreProxyCertificateErrors
    ? new undici.ProxyAgent({ uri: proxyUrl, requestTls: { rejectUnauthorized: false } })
    : new undici.ProxyAgent({ uri: proxyUrl })
  return ofetch.create({ dispatcher: proxyAgent })
}
