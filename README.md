[![nuxt-oidc-auth-social-card](https://github.com/user-attachments/assets/77ab04f8-7823-4dee-bae4-841e46357d6e)](https://nuxt.com/modules/nuxt-oidc-auth)

# Nuxt OIDC Auth

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Welcome to __Nuxt OIDC Auth__, a Nuxt module focusing on native OIDC (OpenID Connect) based authentication for Nuxt with a high level of customizability and security for SSR applications.
This module doesn't use any external dependencies outside of the [unjs](https://unjs.io/) ecosystem except for token validation (the well known and tested `jose` library for JWT interactions).

👉 [Documentation](https://nuxtoidc.cloud/)

## Features

↩️&nbsp; Automatic session and token renewal<br>
💾&nbsp; Encrypted server side refresh/access token storage powered by Nitro storage<br>
🔑&nbsp; Token validation<br>
🔒&nbsp; Secured & sealed cookies sessions<br>
⚙️&nbsp; Presets for popular OIDC providers<br>
📤&nbsp; Global middleware with automatic redirection to default provider or a custom login page (see playground)<br>
👤&nbsp; `useOidcAuth` composable for getting the user information, logging in and out, refetching the current session and triggering a token refresh<br>
🗂️&nbsp; Multi provider support with auto registered routes (`/auth/<provider>/login`, `/auth/<provider>/logout`, `/auth/<provider>/callback`)<br>
📝&nbsp; Generic spec OpenID compatible connect provider with fully configurable OIDC flow (state, nonce, PKCE, token request, ...)<br>
🕙&nbsp; Session expiration check<br>

## Installation

### Add `nuxt-oidc-auth` dependency to your project

With nuxi

```bash
pnpm dlx nuxi@latest module add nuxt-oidc-auth
```

or manually

```bash
pnpm add nuxt-oidc-auth
```

Add `nuxt-oidc-auth` to the `modules` section of `nuxt.config.ts`

```js
export default defineNuxtConfig({
  modules: [
    'nuxt-oidc-auth'
  ]
})
```

## ⚠️ Disclaimer

This module is still in development, feedback and contributions are welcome! Use at your own risk.

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/nuxt-oidc-auth?labelColor=18181B&color=28CF8D
[npm-version-href]: https://npmjs.com/package/nuxt-oidc-auth

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-oidc-auth?labelColor=18181B&color=28CF8D
[npm-downloads-href]: https://npmjs.com/package/nuxt-oidc-auth

[license-src]: https://img.shields.io/npm/l/nuxt-oidc-auth?labelColor=18181B&color=28CF8D
[license-href]: https://npmjs.com/package/nuxt-oidc-auth

[nuxt-src]: https://img.shields.io/badge/Nuxt-18181B?logo=nuxt.js
[nuxt-href]: https://nuxt.com
