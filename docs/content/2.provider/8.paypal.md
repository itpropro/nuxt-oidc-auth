---
title: PayPal
description: PayPal provider documentation
icon: i-simple-icons-paypal
---

## Feature/OIDC support

❌&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

## Introduction

PayPal doesn't support modern security standards like PKCE and is lacking OIDC features like logout redirect functionality.
The developer center can be confusing sometimes, make sure to use the correct users for testing and the right credentials.

You have to enable the "Login with PayPal" functionality first before being able to use PayPal for login:

::contentImage{src="/content/paypal-enable_login.png" alt="Enable Login with PayPal"}
::

### Scopes

By default the PayPal provider used the `openid` scope. If you need more use information, you can add standard OIDC scopes (like `profile` or `email`) or custom PayPal ones like `https://uri.paypal.com/services/paypalattributes`.
Before adding additional scopes, make sure you have checked at least one of the following checkboxes.

::contentImage{src="/content/paypal-scopes.png" alt="PayPal Scopes"}
::

### Sandbox

For testing, PayPal provides test accounts and endpoints that are separate from PayPals production infrastructure.

::callout{icon="i-carbon-warning-alt" color="amber"}
For testing use the account with type **Personal** from **Testing Tools** -> **Sandbox Accounts**. Trying to use a business account will always fail to retrieve information from the userinfo endpoint. This is unfortunately undocumented.
::

## Provider specific parameters

This providers doesn't have specific parameters.

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
paypal: {
  clientId: '',
  clientSecret: '',
  scope: ['openid', 'profile'],
  authorizationUrl: 'https://www.sandbox.paypal.com/signin/authorize?flowEntry=static', // Replace depending on sandbox or production environment
  tokenUrl: 'https://api-m.sandbox.paypal.com/v1/oauth2/token', // Replace depending on sandbox or production environment
  userInfoUrl: 'https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo?schema=openid', // Replace depending on sandbox or production environment
  redirectUri: 'http://127.0.0.1:3000/auth/paypal/callback', // PayPal doesn't support localhost for http, only 127.0.0.1
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

PayPal only supports IPs for local development, so you have to set the redirectUri to 127.0.0.1 and set Nuxt to expose on that address via. the `.env` `HOST` entry.

::contentImage{src="/content/paypal-redirect.png" alt="PayPal Scopes"}
::

```ini [.env]
# Only enable the HOST entry when testing PAYPAL
HOST=127.0.0.1
NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_ID=CLIENT_ID
NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_SECRET=CLIENT_SECRET
```