---
title: AWS Cognito
description: AWS Cognito provider documentation
icon: i-simple-icons-amazonaws
---

## Feature/OIDC support

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

AWS Congito doesn't correctly implement the OAuth 2 standard and doesn't provide a `aud` field for the audience. Therefore it is not possible to verify the access or id token.

## Introduction

For AWS Cognito you have to provide at least the `baseUrl`, `clientId`, `clientSecret` and `logoutRedirectUri` properties. The `baseUrl` is used to dynamically create the `authorizationUrl`, `tokenUrl`, `logoutUrl` and `userInfoUrl`.
The only supported OAuth grant type is `Authorization code grant`.
The final url should look something like this `https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_SOMEID/.well-known/openid-configuration`.
You will also encounter an error, if you have not correctly registered the `redirectUri` under "Allowed callback URLs" or the `logoutRedirectUri` under "Allowed sign-out URLs".
If you need additional scopes, specify them in the `scope` property in you nuxt config like `scope: ['openid', 'email', 'profile'],`.

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
cognito: {
  clientId: '',
  redirectUri: 'http://localhost:3000/auth/cognito/callback',
  clientSecret: '',
  scope: ['openid', 'email', 'profile'],
  logoutRedirectUri: 'https://google.com',
  baseUrl: '',
  exposeIdToken: true, // This is necessary to validate the logout redirect. If you don't need the ID token and don't use a logout redirect, set this to false.
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]
NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_ID=CLIENT_ID
NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_SECRET=CLIENT_SECRET
NUXT_OIDC_PROVIDERS_COGNITO_BASE_URL=https://YOURAPP.auth.eu-north-1.amazoncognito.com
```
