import type { OidcProviderConfig } from '../types/oidc'
import { createDefu } from 'defu'

type MakePropertiesRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Cannot import from utils here, otherwise Nuxt will throw '[worker reload] [worker init] Cannot access 'configMerger' before initialization'
const configMerger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = key === 'requiredProperties' ? Array.from(new Set(obj[key].concat(value))) : value as any
    return true
  }
})

export function defineOidcProvider<TConfig, TRequired extends keyof OidcProviderConfig>(config: Partial<OidcProviderConfig> & { additionalAuthParameters?: TConfig, additionalTokenParameters?: TConfig } = {} as any) {
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
  return mergedConfig as MakePropertiesRequired<Partial<typeof mergedConfig>, TRequired>
}
