// @unocss-include

export function useProviders(currentProvider: string) {
  const providers = ref([
    {
      label: 'Microsoft Entra ID',
      name: 'entra',
      disabled: Boolean(currentProvider === 'entra'),
      icon: 'i-simple-icons-microsoftazure',
    },
    {
      label: 'Auth0',
      name: 'auth0',
      disabled: Boolean(currentProvider === 'auth0'),
      icon: 'i-simple-icons-auth0',
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
