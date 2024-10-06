---
title: Entra ID
description: Entra ID provider documentation
icon: i-simple-icons-microsoftazure
---

## Feature/OIDC support

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
⚠️&nbsp; Access Token validation (Supported, but disabled as only possible for custom audience tokens)<br>
✅&nbsp; ID Token validation<br>

## Introduction

This provider is specifically preconfigured to be used with Entra ID or Entra External ID (successor of Azure AD B2C).
If you just need a social login using a Microsoft Account, use the [Microsoft provider](/provider/microsoft), which provides a simplified version for social login.

If you are requesting a token for an application registered in Entra ID (for example an API), you need to set the resource to the id of that app registration. You should also set the audience to that ID, so the token can be correctly validated.

You should also consider setting the `userInfoUrl` to `https://graph.microsoft.com/v1.0/me` if you are just requesting permission scopes for Graph API. This endpoint will not work for custom APIs/App registrations.

## Provider specific parameters

Additional parameters to be used in `additionalAuthParameters`, `additionalTokenParameters` or `additionalLogoutParameters`:

| Option | Type | Default | Description |
|---|---|---|---|
| resource | `string` | - | Optional. The resource identifier for the requested resource. |
| audience   | `string` | - | Optional. The audience for the token, typically the client ID. |
| prompt | `string` | - | Optional. Indicates the type of user interaction that is required. Valid values are `login`, `none`, `consent`, and `select_account`. |
| loginHint | `string` | - | Optional. You can use this parameter to pre-fill the username and email address field of the sign-in page for the user. Apps can use this parameter during reauthentication, after already extracting the login_hint optional claim from an earlier sign-in. |
| logoutHint | `string` | - | Optional. Enables sign-out to occur without prompting the user to select an account. To use logout_hint, enable the login_hint optional claim in your client application and use the value of the login_hint optional claim as the logout_hint parameter. |
| domainHint | `string` | - | Optional. If included, the app skips the email-based discovery process that user goes through on the sign-in page, leading to a slightly more streamlined user experience. |

If you want to validate access tokens from Microsoft Entra ID (previously Azure AD), you need to make sure that the scope includes your own API. You have to register an API first and expose some scopes to your App Registration that you want to request. If you only have GraphAPI entries like `openid`, `mail` GraphAPI specific ones in your scope, the returned access token cannot and should not be verified. If the scope is set correctly, you can set `validateAccessToken` option to `true`.

If you use this module with Entra External ID (previously Entra ID for Customers) make sure you have set the `audience` config field to your application id, otherwise it will not be possible to get a valid OpenID Connect well-known configuration and thereby verify the JWT token.

## Example Configuration

::callout{icon="i-carbon-warning-alt" color="amber"}
Never store sensitive values like your client secret in your Nuxt config. Our recommendation is to inject at least client id and client secret via. environment variables.
::

```typescript [nuxt.config.ts]
entra: {
  redirectUri: 'http://localhost:3000/auth/entra/callback',
  clientId: '',
  clientSecret: '',
  authorizationUrl: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize', // For Entra External ID, use https://TENANT_NAME.ciamlogin.com/TENANT_ID/oauth2/authorize
  tokenUrl: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token', // For Entra External ID, use https://TENANT_NAME.ciamlogin.com/TENANT_ID/oauth2/token
  userNameClaim: 'unique_name',
  nonce: true,
  responseType: 'code id_token',
  scope: ['profile', 'openid', 'offline_access', 'email'],
  logoutUrl: 'https://login.microsoftonline.com/TENANT_ID/oauth2/logout', // For Entra External ID, use https://TENANT_NAME.ciamlogin.com/TENANT_ID/oauth2/logout
  optionalClaims: ['unique_name', 'family_name', 'given_name', 'login_hint'],
  audience: '', // In case you need access to an App/API registered in Entra ID
  additionalAuthParameters: {
    resource: '', // Needs to match the audience
    prompt: 'select_account', // 'login' | 'none' | 'consent' | 'select_account'
  },
  additionalLogoutParameters: {
    logoutHint: '', // Enables sign-out to occur without prompting the user to select an account. Remove if you don't need this or don't have requested the `login_hint` claim
  },
  allowedClientAuthParameters: [
    'test', // Can be used with the `login` composable function to provide additional parameters for example a locale for i18n
  ],
  validateAccessToken: true,
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me', // Set only if you are sure, you are requesting a Graph API token. This endpoint will not work for custom APIs/App registrations.
},
```

### Environment variables

Dotenv files are only for (local) development. Use a proper configuration management or injection system in production.

```ini [.env]
NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_SECRET=CLIENT_SECRET
NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_ID=CLIENT_ID
NUXT_OIDC_PROVIDERS_ENTRA_AUDIENCE=AUDIENCE # In case you need access to an App/API registered in Entra ID
NUXT_OIDC_PROVIDERS_ENTRA_USER_NAME_CLAIM=given_name
NUXT_OIDC_PROVIDERS_ENTRA_AUTHORIZATION_URL=https://login.microsoftonline.com/TENANT_ID/oauth2/authorize # For Entra External ID, use https://TENANT_NAME.ciamlogin.com/TENANT_ID/oauth2/authorize
NUXT_OIDC_PROVIDERS_ENTRA_TOKEN_URL=https://login.microsoftonline.com/TENANT_ID/oauth2/token # For Entra External ID, use https://TENANT_NAME.ciamlogin.com/TENANT_ID/oauth2/token
NUXT_OIDC_PROVIDERS_ENTRA_LOGOUT_URL=https://login.microsoftonline.com/TENANT_ID/oauth2/logout # For Entra External ID, use https://TENANT_NAME.ciamlogin.com/TENANT_ID/oauth2/logout
NUXT_OIDC_PROVIDERS_ENTRA_ADDITIONAL_AUTH_PARAMETERS_RESOURCE=RESOURCE_ID # Needs to match the audience
NUXT_OIDC_PROVIDERS_ENTRA_VALIDATE_ACCESS_TOKEN=true # Adjust based on if you are requesting a custom or a Graph API token. Graph API tokens cannot be decoded and thereby not validated.
```
