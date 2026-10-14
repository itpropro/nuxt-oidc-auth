// @unocss-include

import type { Ref } from 'vue'

import type { ProviderKeysWithDev } from '../../src/runtime/types'

interface Provider {
  label: string
  name: ProviderKeysWithDev
  disabled: boolean
  icon: string
}

export function useProviders(currentProvider: ProviderKeysWithDev | undefined): {
  providers: Ref<Provider[]>
} {
  const providers = ref<Provider[]>([
    {
      label: 'Auth0',
      name: 'auth0',
      disabled: currentProvider === 'auth0',
      icon: 'i-simple-icons-auth0',
    },
    {
      label: 'AWS Cognito',
      name: 'cognito',
      disabled: currentProvider === 'cognito',
      icon: 'i-simple-icons-amazoncognito',
    },
    {
      label: 'GitHub',
      name: 'github',
      disabled: currentProvider === 'github',
      icon: 'i-simple-icons-github',
    },
    {
      label: 'Keycloak',
      name: 'keycloak',
      disabled: currentProvider === 'keycloak',
      icon: 'i-simple-icons-cncf',
    },
    {
      label: 'Logto',
      name: 'logto',
      disabled: currentProvider === 'logto',
      icon: 'i-simple-icons-openid',
    },
    {
      label: 'PayPal',
      name: 'paypal',
      disabled: currentProvider === 'paypal',
      icon: 'i-simple-icons-paypal',
    },
    {
      label: 'Microsoft',
      name: 'microsoft',
      disabled: currentProvider === 'entra',
      icon: 'i-simple-icons-microsoft',
    },
    {
      label: 'Microsoft Entra ID',
      name: 'entra',
      disabled: currentProvider === 'entra',
      icon: 'i-simple-icons-microsoftazure',
    },
    {
      label: 'Zitadel',
      name: 'zitadel',
      disabled: currentProvider === 'zitadel',
      icon: 'i-majesticons-puzzle',
    },
    {
      label: 'Generic OIDC',
      name: 'oidc',
      disabled: currentProvider === 'oidc',
      icon: 'i-simple-icons-openid',
    },
  ])
  return {
    providers,
  }
}
