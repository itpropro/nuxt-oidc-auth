---
title: Keycloak
description: Keycloak provider documentation
icon: i-simple-icons-keycloak
---

## Feature/OIDC support

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
❌&nbsp; State<br>
✅&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

## Introduction

## Provider specific parameters

Additional parameters to be used in additionalAuthParameters,
 additionalTokenParameters or additionalLogoutParameters:

| Option | Type | Default | Description |
|---|---|---|---|
| realm | `string` | - | Optional. This parameter allows to slightly customize the login flow on the Keycloak server side. For example, enforce displaying the login screen in case of value login. |
| realm | `string` | - | Optional. Used to pre-fill the username/email field on the login form. |
| realm | `string` | - | Optional. Used to tell Keycloak to skip showing the login page and automatically redirect to the specified identity provider instead. |
| realm | `string` | - | Optional. Sets the 'ui_locales' query param. |

For more information on these parameters, check the [KeyCloak documentation](https://www.keycloak.org/docs/latest/securing_apps/#methods).

For Keycloak you have to provide at least the `baseUrl`, `clientId` and `clientSecret` properties. The `baseUrl` is used to dynamically create the `authorizationUrl`, `tokenUrl`, `logoutUrl` and `userInfoUrl`.
Please include the realm you want to use in the `baseUrl` (e.g. `https://<keycloak-url>/realms/<realm>`).
If you don't want to use the post logout redirect feature of key cloak, set `logoutUrl` to `undefined` or `''`.
Also remember to enable `Client authentication` to be able to get a client secret.

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
keycloak: {
  audience: 'account',
  baseUrl: '',
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://localhost:3000/auth/keycloak/callback',
  userNameClaim: 'preferred_username',
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET=CLIENT_SECRET
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID=CLIENT_ID
NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL=http://localhost:8080/realms/nuxt-oidc-test
```
