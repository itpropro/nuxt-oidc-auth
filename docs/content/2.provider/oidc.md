---
title: Generic OIDC (advanced)
description: Generic OIDC provider documentation
icon: i-simple-icons-openid
---

## Introduction

This is a generic OIDC provider that doesn't provide any preconfiguration or helpers to automatically generate URL.
If your provider is not listed, you should be able to configure it with this provider.

This is the generic providers default configuration:

```typescript
const defaults: Partial<OidcProviderConfig> = {
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
  skipAccessTokenParsing: false,
  exposeAccessToken: false,
  exposeIdToken: false,
  callbackRedirectUrl: '/',
  allowedClientAuthParameters: undefined,
  logoutUrl: '',
  sessionConfiguration: undefined,
  additionalAuthParameters: undefined,
  additionalTokenParameters: undefined,
  additionalLogoutParameters: undefined,
  excludeOfflineScopeFromTokenRequest: false,
}
```

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
oidc: {
  clientId: '',
  clientSecret: '',
  responseType: 'code id_token',
  validateAccessToken: false,
  validateIdToken: false,
  skipAccessTokenParsing: true,
  state: true,
  nonce: true,
  pkce: true,
  tokenRequestType: 'form-urlencoded',
  scope: ['openid', 'email'],
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  redirectUri: '',
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]
EVERY AVAILABLE PARAMETER
```
