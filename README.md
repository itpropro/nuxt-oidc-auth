# Nuxt OIDC Auth

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Welcome to __Nuxt OIDC Auth__ a Nuxt module focusing on OIDC (OpenID Connect) provider based authentication for Nuxt.
We use no external dependencies outside of the [unjs](https://unjs.io/) ecosystem except for token validation. This module is based on the session implementation of nuxt-auth-utils.

If you are looking for a module for local authentication without an external identity provider (and much more) provided by your Nuxt server check out the nuxt-auth module from sidebase (powered by authjs and NextAuth) ➡️ [nuxt-auth](https://github.com/sidebase/nuxt-auth)

## ⚠️ Disclaimer

This module is still in development

Contributions are welcome!

## Features

- Secured & sealed cookies sessions
- Generic spec compliant OpenID connect provider
- Presets for popular OAuth providers
- Encrypted server side refresh/access token storage powered by unstorage
- Session expiration check
- Automatic session renewal when session is expired

## Requirements

This module only works with SSR (server-side rendering) enabled as it uses server API routes. You cannot use this module with `nuxt generate`.

:warning: This currently only builds when using the knitwork feature branch feature/base64. To reference it, just clone the knitwork repo and run `git checkout feature/base64`, `pnpm i && pnpm build` and update the file based reference in the `package.json`.

## Quick Setup

1. Add `nuxt-oidc-auth` dependency to your project

```bash
# Using pnpm
pnpm add -D nuxt-oidc-auth

# Using yarn
yarn add --dev nuxt-oidc-auth

# Using npm
npm install --save-dev nuxt-oidc-auth
```

2. Add `nuxt-oidc-auth` to the `modules` section of `nuxt.config.ts`

```js
export default defineNuxtConfig({
  modules: [
    'nuxt-oidc-auth'
  ]
})
```

3. Set secrets

Nuxt-OIDC-Auth uses three different secrets to encrypt the user session, the in individual auth sessions and the persistent server side token store. You can set them using environment variables or in the `.env` file.
All of the secrets are auto generated if not set, but should be set manually in production. This is especially important for the session storage, as it won't be accessible anymore if the secret changes for example after a server restart.

- NUXT_OIDC_SESSION_SECRET (random string): This should be a at least 48 characters random string. It is used to encrypt the user session.
- NUXT_OIDC_TOKEN_KEY (random key): This needs to be a random cryptographic AES key in base64. Used to encrypt the server side token store. You can generate a key in JS with `await subtle.exportKey('raw', await subtle.generateKey({ name: 'AES-GCM', length: 256, }, true, ['encrypt', 'decrypt']))`, you just have to encode it to base64 afterwards.
- NUXT_OIDC_AUTH_SESSION_SECRET (random string): This should be a at least 48 characters random string. It is used to encrypt the individual sessions during OAuth flows.

```bash
Add a `NUXT_OIDC_SESSION_SECRET` env variable with at least 48 characters in the `.env`.

```bash
# .env
NUXT_OIDC_TOKEN_KEY=base64_encoded_key
NUXT_OIDC_SESSION_SECRET=48_characters_random_string
NUXT_OIDC_AUTH_SESSION_SECRET=48_characters_random_string
```

4. That's it! You can now add authentication to your Nuxt app ✨

## Vue Composables

Nuxt Auth Utils automatically adds some plugins to fetch the current user session to let you access it from your Vue components.

### User Session

```vue
<script setup>
const { loggedIn, user, session, clear, refresh } = useUserSession()
</script>

<template>
  <div v-if="loggedIn">
    <h1>Welcome {{ user.userName }}!</h1>
    <p>Logged in since {{ session.loggedInAt }}</p>
    <button @click="clear">Logout</button>
  </div>
  <div v-else>
    <h1>Not logged in</h1>
    <a href="/api/auth/github">Login with GitHub</a>
  </div>
</template>
```

## Server Utils

The following helpers are auto-imported in your `server/` directory.

### Session Management

```ts
// Set a user session, note that this data is encrypted in the cookie but can be decrypted with an API call
// Only store the data that allow you to recognize an user, but do not store sensitive data
await setUserSession(event, {
  user: {
    // ... user data
  },
  loggedInAt: new Date()
  // Any extra fields
})

// Get the current user session
const session = await getUserSession(event)

// Clear the current user session
await clearUserSession(event)

// Require a user session (send back 401 if no `user` key in session)
const session = await requireUserSession(event)
```

### Session expiration and refresh

Nuxt-OIDC-Auth automatically checks if the session is expired and refreshes it if necessary. You can disable this behavior by setting `expirationCheck` and `automaticRefresh` to `false` in the `session` configuration.
The session is automatically refreshed when the `session` object is accessed. You can also manually refresh the session by calling `refreshUserSession(event)`.

Session expiration and refresh is handled completely server side, the exposed properties in the user session are automatically updated. You can theoretically register a hook that overwrites session fields like loggedInAt, but this is not recommended and will be overwritten with each refresh.

### OIDC Event Handlers

All configured providers automatically register the following server routes.

- `/auth/<provider>/callback`
- `/auth/<provider>/login`
- `/auth/<provider>/logout`

The `config` can be defined directly from the `runtimeConfig` in your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    oidc: {
      providers: {
        <provider>: {
          clientId: '...',
          clientSecret: '...'
        }
      }
    }
  }
})
```

It can also be set using environment variables:

- `NUXT_OIDC_PROVIDERS_PROVIDER_CLIENT_ID`
- `NUXT_OIDC_PROVIDERS_PROVIDER_CLIENT_SECRET`

#### Supported OAuth Providers

Nuxt Oidc Auth includes presets for the following providers with tested default values:

- Auth0
- GitHub
- Microsoft
- Microsoft Entra ID (previously Azure AD)
- Generic OIDC

You can add a generic OpenID Connect provider by using the `oidc` provider key in the configuration. Remember to set the required fields and expect your provider to behave slightly different than defined in the OAuth and OIDC specifications.

Make sure to set the callback URL in your OAuth app settings as `<your-domain>/auth/github`.

### Hooks

The following hooks are available to extend the default behavior of the OIDC module:

- `fetch` (Called when a user session is fetched)
- `clear` (Called before a user session is cleared)
- `refresh` (Called before a user session is refreshed)

#### Example

```ts
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    // Extend User Session
    // Or throw createError({ ... }) if session is invalid
    // session.extended = {
    //   fromHooks: true
    // }
    console.log('Injecting "country" claim as test')
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { country: 'Germany' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
  })

  sessionHooks.hook('clear', async (session) => {
    // Log that user logged out
    console.log('User logged out')
  })
})
```

You can theoretically register a hook that overwrites internal session fields like `loggedInAt`, but this is not recommended as it has an impact on the loggedIn state of your session. It will not impact the server side refresh and expiration logic, but will be overwritten with each refresh.

## Configuration reference

### `oidc`

| Option | Type | Default | Description |
|---|---|---|---|
| enabled | boolean | - | Enables/disables the module |

### `<provider>`

| Option | Type | Default | Description |
|---|---|---|---|
| clientId | `string` | - | Client ID |
| clientSecret | `string` | - | Client Secret |
| responseType | `'code'` \| `'code token'` \| `'code id_token'` \| `'id_token token'` \| `'code id_token token'` (optional) | - | Response Type |
| authenticationScheme | `'header'` \| `'body'` (optional) | - | Authentication scheme |
| responseMode | `'query'` \| `'fragment'` \| `'form_post'` (optional) | - | Response Mode |
| authorizationUrl | `string` (optional) | - | Authorization Endpoint URL |
| tokenUrl | `string` (optional) | - | Token Endpoint URL |
| userinfoUrl | `string` (optional) | '' | Userinfo Endpoint URL |
| redirectUri | `string` (optional) | - | Redirect URI |
| grantType | `'authorization_code'` \| 'refresh_token' (optional) | 'authorization_code' | Grant Type |
| scope | `string`[] (optional) | ['openid'] | Scope |
| pkce | `boolean` (optional) | true | Use PKCE (Proof Key for Code Exchange) |
| state | `boolean` (optional) | true | Use state parameter with a random value. If state is not used, the nonce parameter is used to identify the flow. |
| nonce | `boolean` (optional) | false | Use nonce parameter with a random value. |
| userNameClaim | `string` (optional) | '' | User name claim that is used to get the user name from the access token as a fallback in case the userinfo endpoint is not provided or the userinfo request fails. |
| optionalClaims | `string[]` (optional) | - | Claims to be extracted from the id token |
| logoutUrl | `string` (optional) | '' | Logout Endpoint URL |
| scopeInTokenRequest | `boolean` (optional) | false | Include scope in token request |
| tokenRequestType | `'form'` \| `'json'` (optional) | `'form'` | Token request type |
| audience | `string` (optional) | - | Audience used for token validation (not included in requests by default, use additionalTokenParameters or additionalAuthParameters to add it) |
| requiredProperties | `string`[] | - | An array of required properties. |
| filterUserinfo | `string[]`(optional) | - | An array of required properties. |
| skipAccessTokenParsing | `boolean`(optional) | - | An array of required properties. |
| logoutRedirectParameterName | `string` (optional) | - | The name of the logout redirect parameter. |
| additionalAuthParameters | `Record<string, string>` (optional) | - | Additional authentication parameters. |
| additionalTokenParameters | `Record<string, string>` (optional) | - | Additional token parameters. |
| baseUrl | `string` (optional) | - | The base URL. |
| openIdConfiguration | `Record<string, unknown>` or `function (config) => Record<string, unknown>` (optional) | - | The OpenID configuration, can be an object or a function returning a promise. |
| validateAccessToken | `boolean` (optional) | - | Whether to validate the access token. |
| validateIdToken | `boolean` (optional) | - | Whether to validate the ID token. |

### `session`

The following options are available for the session configuration.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| expirationCheck | `boolean` | `true` | Check if session is expired |
| automaticRefresh | `boolean` | `true` | Automatically refresh session when expired |

```ts
  oidc: {
    ...
    session: {
      expirationCheck: true,
      automaticRefresh: true,
    }
  }
```

### Provider specific configurations

Some providers have specific additional fields that can be used to extend the authorization or token request. These fields are available via. `additionalAuthParameters` or `additionalTokenParameters` in the provider configuration.

:warning: Tokens will only be validated, if the `clientId` or the optional `audience` field is part of the access_tokens audiences. Even if `validateAccessToken` or `validateIdToken` is set, if the audience doesn't match, the token should and will not be validated.

#### Auth0

| Option         | Type   | Default | Description       |
| --- | --- | --- | --- |
| connection     | `string` |         | Optional. Specifies the connection.     |
| organization   | `string` |         | Optional. Specifies the organization.   |
| invitation     | `string` |         | Optional. Specifies the invitation.     |
| loginHint      | `string` |         | Optional. Specifies the login hint.     |

- Depending on the settings of your apps `Credentials` tab, set `authenticationScheme` to `body` for 'Client Secret (Post)', set to `header` for 'Client Secret (Basic)', set to `''` for 'None'

#### Entra ID/Microsoft

If you want to validate access tokens from Microsoft Entra ID (previously Azure AD), you need to make sure that the scope includes your own API. You have to register an API first and expose some scopes to your App Registration that you want to request. If you only have GraphAPI entries like `openid`, `mail` GraphAPI specific ones in your scope, the returned access token cannot and should not be verified. If the scope is set correctly, you can set `validateAccessToken` option to `true`.

#### GitHub

GitHub is not strictly an OIDC provider, but it can be used as one. Make sure that validation is disabled and that you keep the `skipAccessTokenParsing` option to `true`.

Try to use a [GitHub App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps), not the legacy OAuth app. They don't provide the same level of security, have no granular permissions, don't provide refresh tokens and are not tested.

## Development

```bash
# Install dependencies
npm install

# Generate type stubs
npm run dev:prepare

# Develop with the playground
npm run dev

# Build the playground
npm run dev:build

# Run ESLint
npm run lint

# Run Vitest
npm run test
npm run test:watch

# Release new version
npm run release
```

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/nuxt-oidc-auth/latest.svg?style=flat&colorA=18181B&colorB=28CF8D
[npm-version-href]: https://npmjs.com/package/nuxt-oidc-auth

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-oidc-auth.svg?style=flat&colorA=18181B&colorB=28CF8D
[npm-downloads-href]: https://npmjs.com/package/nuxt-oidc-auth

[license-src]: https://img.shields.io/npm/l/nuxt-oidc-auth.svg?style=flat&colorA=18181B&colorB=28CF8D
[license-href]: https://npmjs.com/package/nuxt-oidc-auth

[nuxt-src]: https://img.shields.io/badge/Nuxt-18181B?logo=nuxt.js
[nuxt-href]: https://nuxt.com
