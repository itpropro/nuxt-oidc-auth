---
title: Microsoft
description: Microsoft provider documentation
icon: i-simple-icons-microsoft
---

## Feature/OIDC support

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
✅&nbsp; ID Token validation<br>

## Introduction

This is the simplified Microsoft provider for social login with a Microsoft Account (MSA). You need access to the Azure portal (portal.azure.com) to configure an app registration and get the required properties.
Learn how to creat an app registration [here](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=client-secret).
Be sure that you select one of the bottom two options if you want persoanl Microsoft accounts to be able to login to your application:

::contentImage{src="/content/microsoft-accounttype.png" alt="Microsoft account types"}
::

Choose 'Web' as the target platform under `Manage` -> `Authentication` -> `Platform configurations`

::contentImage{src="/content/microsoft-platform.png" alt="Microsoft Platform configurations"}
::

This provider uses the predefined userInfo url `https://graph.microsoft.com/v1.0/me` to get user information for an account.

## Example Configurations

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

### Minimal

```typescript [nuxt.config.ts]
entra: {
  redirectUri: 'http://localhost:3000/auth/microsoft/callback',
  clientId: '',
  clientSecret: '',
},
```

### Get user information

You can also add the `profile` or another OIDC common scope. `User.Read` as a delegated permission is configured by default in **API permissons**.

```typescript [nuxt.config.ts]
entra: {
  redirectUri: 'http://localhost:3000/auth/microsoft/callback',
  clientId: '',
  clientSecret: '',
  responseType: 'code',
  scope: ['openid', 'User.Read'],
},
```

### Get additonal user information with ID token

To be able to use the ID token, make sure you have set the checkbox at **Manage** -> **Authentication** -> **Implicit grant and hybrid flows** -> `ID tokens (used for implicit and hybrid flows)`.
To add additional claims you want to use, configure them on your app registration under **Manage** -> **Token configuration** and add them by using the `optionalClaims: ['name', 'preferred_username'],` parameter.
The default setting is `optionalClaims: ['name', 'preferred_username'],`.

```typescript [nuxt.config.ts]
entra: {
  redirectUri: 'http://localhost:3000/auth/microsoft/callback',
  clientId: '',
  clientSecret: '',
  responseType: 'code id_token',
  scope: ['openid', 'User.Read'],
},
```

### Offline access/refresh token

In order to get a refresh token, you need to add the "Microsoft Graph" delegated permission `offline_access` and add it to the scopes.
**Manage** -> **API permissions** -> `Add a permission`

::contentImage{src="/content/microsoft-scopes.png" alt="Microsoft account types"}
::

```typescript [nuxt.config.ts]
entra: {
  redirectUri: 'http://localhost:3000/auth/microsoft/callback',
  clientId: '',
  clientSecret: '',
  responseType: 'code id_token',
  scope: ['openid', 'User.Read', 'offline_access'],
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]
NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_SECRET=CLIENT_SECRET
NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_ID=CLIENT_ID
```

## Provider specific parameters

| Option | Type | Default | Description |
|---|---|---|---|
| tenantId | `string` | - | Required. The tenant id is used to automatically configure the correct endpoint urls for the Microsoft provider to work. |
| prompt | `string` | 'login' | Optional. Indicates the type of user interaction that is required. Valid values are `login`, `none`, `consent`, and `select_account`. Can be used in `additionalAuthParameters`, `additionalTokenParameters` or `additionalLogoutParameters`. |
| loginHint | `string` | - | Optional. You can use this parameter to pre-fill the username and email address field of the sign-in page for the user. Apps can use this parameter during reauthentication, after already extracting the login_hint optional claim from an earlier sign-in. Can be used in `additionalAuthParameters`, `additionalTokenParameters` or `additionalLogoutParameters`. |
| logoutHint | `string` | - | Optional. Enables sign-out to occur without prompting the user to select an account. To use logout_hint, enable the login_hint optional claim in your client application and use the value of the login_hint optional claim as the logout_hint parameter. Can be used in `additionalAuthParameters`, `additionalTokenParameters` or `additionalLogoutParameters`. |
| domainHint | `string` | - | Optional. If included, the app skips the email-based discovery process that user goes through on the sign-in page, leading to a slightly more streamlined user experience. Can be used in `additionalAuthParameters`, `additionalTokenParameters` or `additionalLogoutParameters`. |
