declare module '#oidc-auth' {
  interface UserSessionClaims {
    login_hint?: string
    status?: string
  }
}

export {}
