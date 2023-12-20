# Nuxt Oidc Auth

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

OIDC (OpenID Connect) focused Authentication module for Nuxt based on nuxt-auth-utils

- [Release Notes](/CHANGELOG.md)
<!-- - [🏀 Online playground](https://stackblitz.com/github/itpropro/nuxt-oidc-auth?file=playground%2Fapp.vue) -->

## Features

- Secured & sealed cookies sessions
- Generic spec compliant OpenID connect provider
- Presets for popular OAuth providers
- Encrypted refresh token storage

## Requirements

This module only works with SSR (server-side rendering) enabled as it uses server API routes. You cannot use this module with `nuxt generate`.

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

3. Add a `NUXT_OIDC_SESSION_SECRET` env variable with at least 48 characters in the `.env`.

```bash
# .env
NUXT_OIDC_SESSION_SECRET=password-with-at-least-48-characters
```

Nuxt Auth Utils can generate one for you when running Nuxt in development the first time when no `NUXT_OIDC_SESSION_SECRET` is set.

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
- ~~Battle.net~~
- ~~Discord~~
- ~~GitHub~~
- ~~Google~~
- ~~LinkedIn~~
- Microsoft
- Microsoft Entra ID (previously Azure AD)
- ~~Spotify~~
- ~~Twitch~~

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
