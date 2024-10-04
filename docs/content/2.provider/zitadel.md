---
title: Zitadel
description: Zitadel provider documentation
icon: i-carbon-z
---

## Feature/OIDC support

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
✅&nbsp; ID Token validation<br>

## Introduction

For Zitadel you have to provide at least the `baseUrl`, `clientId` and `clientSecret` properties. The `baseUrl` is used to dynamically create the `authorizationUrl`, `tokenUrl`, `logoutUrl` and `userInfoUrl`.
The provider supports PKCE and Code authentication schemes. For PKCE just leave the clientSecret set to an empty string ('').

## Provider specific parameters

This providers doesn't have specific parameters.

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
zitadel: {
  clientId: '',
  clientSecret: '', // Works with PKCE and Code flow, just leave empty for PKCE
  redirectUri: 'http://localhost:3000/auth/zitadel/callback', // Replace with your domain
  baseUrl: '', // For example https://PROJECT.REGION.zitadel.cloud
  audience: '', // Specify for id token validation, normally same as clientId
  logoutRedirectUri: 'https://google.com', // Needs to be registered in Zitadel portal
  authenticationScheme: 'none', // Set this to 'header' if Code is used instead of PKCE
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]

```
