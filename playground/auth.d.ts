declare module '#oidc-auth' {
  interface UserSession {
    claims: {
      login_hint: string
    }
  }
  interface ProviderInfo {
    providerName: string
  }
}

export {}
