import type { OidcProviderConfig } from '#oidc-auth'
import { createDefu } from 'defu'

// Merge requiredProperties from provider into config
type MergedOidcProviderConfig<T> = Omit<T, 'requiredProperties'> & Required<Pick<T, Extract<'requiredProperties', keyof T>>>

// Cannot import from utils here, otherwise Nuxt will throw '[worker reload] [worker init] Cannot access 'configMerger' before initialization'
const configMerger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = key === 'requiredProperties' ? Array.from(new Set(obj[key].concat(value))) : value as any
    return true
  }
})

export function defineOidcProvider<TConfig>(config: Partial<OidcProviderConfig> & TConfig) {
  const defaults = {
    clientId: '',
    redirectUri: '',
    clientSecret: '',
    authorizationUrl: '',
    tokenUrl: '',
    responseType: 'code',
    authenticationScheme: 'header',
    grantType: 'authorization_code',
    pkce: false,
    state: true,
    nonce: false,
    scope: ['openid'],
    scopeInTokenRequest: false,
    tokenRequestType: 'form',
    requiredProperties: [
      'scope',
      'responseType',
      'clientId',
      'redirectUri',
      'clientSecret',
      'authorizationUrl',
      'tokenUrl',
    ],
    validateAccessToken: true,
    validateIdToken: true,
  }
  const mergedConfig = configMerger(config, defaults)
  return mergedConfig as MergedOidcProviderConfig<typeof mergedConfig>
}
