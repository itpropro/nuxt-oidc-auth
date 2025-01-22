import { ofetch } from 'ofetch'

export async function getUndiciModule() {
  try {
    const undici = await import('undici')
    return undici
  }
  catch {
    console.warn('Optional dependency \'undici\' is not installed.')
    return null
  }
}

export async function getProxyAgentOfetch(proxyUrl: string, ignoreProxyCertificateErrors = false) {
  const undici = await getUndiciModule()
  if (!undici) {
    throw new Error('Cannot create ProxyAgent, undici module is missing.')
  }
  const proxyAgent = ignoreProxyCertificateErrors ? new undici.ProxyAgent({ uri: proxyUrl, requestTls: { rejectUnauthorized: false } }) : new undici.ProxyAgent({ uri: proxyUrl })
  return ofetch.create({ dispatcher: proxyAgent })
}
