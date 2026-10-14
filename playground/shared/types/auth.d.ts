declare module '#oidc-auth' {
  interface UserSessionClaims {
    login_hint?: string
    status?: string
  }
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- An empty export makes these declarations module augmentations.
export {}
