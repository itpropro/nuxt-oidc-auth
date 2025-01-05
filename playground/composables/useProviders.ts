// @unocss-include

interface Provider {
  label: string
  name: string
  disabled: boolean
  icon: string
}

export function useProviders(currentProvider: string) {
  const providers = ref<Provider[]>([
    {
      label: 'Auth0',
      name: 'auth0',
      disabled: Boolean(currentProvider === 'auth0'),
      icon: 'i-simple-icons-auth0',
    },
    {
      label: 'AWS Cognito',
      name: 'cognito',
      disabled: Boolean(currentProvider === 'cognito'),
      icon: 'i-simple-icons-amazoncognito',
    },
    {
      label: 'GitHub',
      name: 'github',
      disabled: Boolean(currentProvider === 'github'),
      icon: 'i-simple-icons-github',
    },
    {
      label: 'Keycloak',
      name: 'keycloak',
      disabled: Boolean(currentProvider === 'keycloak'),
      icon: 'i-simple-icons-cncf',
    },
    {
      label: 'Microsoft',
      name: 'microsoft',
      disabled: Boolean(currentProvider === 'entra'),
      icon: 'i-simple-icons-microsoft',
    },
    {
      label: 'Microsoft Entra ID',
      name: 'entra',
      disabled: Boolean(currentProvider === 'entra'),
      icon: 'i-simple-icons-microsoftazure',
    },
    {
      label: 'Zitadel',
      name: 'zitadel',
      disabled: Boolean(currentProvider === 'cognito'),
      icon: 'i-majesticons-puzzle',
    },
    {
      label: 'PayPal',
      name: 'paypal',
      disabled: Boolean(currentProvider === 'paypal'),
      icon: 'i-simple-icons-paypal',
    },
    {
      label: 'Generic OIDC',
      name: 'oidc',
      disabled: Boolean(currentProvider === 'oidc'),
      icon: 'i-simple-icons-openid',
    },
  ])
  return {
    providers,
  }
}
