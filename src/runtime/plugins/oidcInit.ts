import type { NitroApp } from 'nitropack/types'
import type { OidcProviderConfig } from '../server/utils/provider'
import type { ProviderConfigs, ProviderURLConfigSet } from '../types'
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { useRuntimeConfig } from 'nitropack/runtime'
import * as providerPresets from '../providers'
import { generateProviderUrl, replaceInjectedParameters } from '../server/utils/config'

export default defineNitroPlugin((nitroApp: NitroApp) => {
  const providerUrls: ProviderURLConfigSet = {}

  const config = useRuntimeConfig()
  const providers = config.oidc.providers as ProviderConfigs
  const providerIds = Object.keys(config.oidc.providers)

  providerIds.forEach((pidKey) => {
    const pid = pidKey as keyof ProviderConfigs
    const provider = providers[pid] as Record<string, any>
    if (!provider) {
      return
    }

    const presets = providerPresets[pid]

    // const baseUrl: string = process.env[`NUXT_OIDC_PROVIDERS_${pid.toUpperCase()}_BASE_URL`]
    const baseUrl: string = config.oidc.providers[pid]?.baseUrl
      || provider.baseUrl
      || presets.baseUrl

    // Generate provider routes
    if (baseUrl) {
      let _baseUrl = baseUrl
      const placeholders = baseUrl.matchAll(/\{(.*?)\}/g)
      for (const placeholderMatch of placeholders) {
        if (placeholderMatch && provider && placeholderMatch[1] in provider) {
          _baseUrl = _baseUrl.replace(`{${placeholderMatch[1]}}`, provider[placeholderMatch[1]])
        }
      }

      providerUrls[pid] = {
        authorizationUrl: generateProviderUrl(_baseUrl, presets.authorizationUrl),
        tokenUrl: generateProviderUrl(_baseUrl, presets.tokenUrl),
        userInfoUrl: presets.userInfoUrl
          ? presets.userInfoUrl.startsWith('https') ? presets.userInfoUrl : generateProviderUrl(_baseUrl, presets.userInfoUrl)
          : undefined,
        logoutUrl: presets.logoutUrl ? generateProviderUrl(_baseUrl, presets.logoutUrl) : undefined,
      }
    }
    else {
      providerUrls[pid] = {
        authorizationUrl: presets.authorizationUrl || '',
        tokenUrl: presets.tokenUrl || '',
        userInfoUrl: presets.userInfoUrl,
        logoutUrl: presets.logoutUrl,
      }
    }
  })

  nitroApp.hooks.hook('request', (event) => {
    event.context.providerUrls = providerUrls
  })
})
