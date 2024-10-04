---
title: GitHub
description: GitHub provider documentation
icon: i-simple-icons-github
---

## Feature/OIDC support

❌&nbsp; PKCE<br>
❌&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

## Introduction

GitHub is not strictly an OIDC provider, but it can be used as one. Make sure that validation is disabled and that you keep the `skipAccessTokenParsing` option to `true`.

Try to use a [GitHub App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps), not the legacy OAuth app. They don't provide the same level of security, have no granular permissions, don't provide refresh tokens and are not tested.

Make sure to set the callback URL in your OAuth app settings as `<your-domain>/auth/github`.

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
github: {
  redirectUri: 'http://localhost:3000/auth/github/callback',
  clientId: '',
  clientSecret: '',
  filterUserInfo: ['login', 'id', 'avatar_url', 'name', 'email'],
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]
NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_SECRET=CLIENT_SECRET
NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_ID=CLIENT_ID
```
