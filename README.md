[![nuxt-oidc-auth-social-card](https://github.com/itpropro/nuxt-oidc-auth/assets/15030951/41173d50-afd4-4d1e-8cd0-e377d7f7effc)](https://nuxt.com/modules/nuxt-oidc-auth)

# Nuxt OIDC Auth

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Welcome to __Nuxt OIDC Auth__, a Nuxt module focusing on native OIDC (OpenID Connect) based authentication for Nuxt with a high level of customizability and security for SSR applications.
This module doesn't use any external dependencies outside of the [unjs](https://unjs.io/) ecosystem except for token validation (the well known and tested `jose` library for JWT interactions).
This module's session implementation is based on [nuxt-auth-utils](https://github.com/Atinux/nuxt-auth-utils).

<!--- [Playground Demo](https://stackblitz.com/github/itpropro/nuxt-oidc-auth/tree/main/playground) -->

## Features

🔒&nbsp; Secured & sealed cookies sessions<br>
📝&nbsp; Generic spec compliant OpenID connect provider with fully configurable OIDC flow (state, nonce, PKCE, token request, ...)<br>
⚙️&nbsp; Presets for [popular OIDC providers](#supported-openid-connect-providers)<br>
🗂️&nbsp; Multi provider support with auto registered routes (`/auth/<provider>/login`, `/auth/<provider>/logout`, `/auth/<provider>/callback`)<br>
👤&nbsp; `useOidcAuth` composable for getting the user information, logging in and out, refetching the current session and triggering a token refresh<br>
💾&nbsp; Encrypted server side refresh/access token storage powered by unstorage<br>
📤&nbsp; Optional global middleware with automatic redirection to default provider or a custom login page (see playground)<br>
🔑&nbsp; Optional token validation<br>
🕙&nbsp; Optional session expiration check based on token expiration<br>
↩️&nbsp; Optional automatic session renewal when token is expired<br>

If you are looking for a module that supports local authentication (and more) provided by your Nuxt server, check out the nuxt-auth module from sidebase (powered by authjs and NextAuth) ➡️ [nuxt-auth](https://github.com/sidebase/nuxt-auth)

### Recent breaking changes

⚠️ Since 0.16.0, the data from the providers userInfo endpoint is written into `userInfo` on the user object instead of `providerInfo`. 
Please adjust your `nuxt.config.ts` and .env/environment files and configurations accordingly.
If you are using the user object from the `useOidcAuth` composable change the access to `providerInfo` to `userInfo`.

## Installation

### Add `nuxt-oidc-auth` dependency to your project

With nuxi

```bash
pnpm dlx nuxi@latest module add nuxt-oidc-auth
```

or manually

```bash
pnpm add -D nuxt-oidc-auth
```

Add `nuxt-oidc-auth` to the `modules` section of `nuxt.config.ts`

```js
export default defineNuxtConfig({
  modules: [
    'nuxt-oidc-auth'
  ]
})
```

### Set secrets

Nuxt OIDC Auth uses three different secrets to encrypt the user session, the individual auth sessions and the persistent server side token store. You can set them using environment variables or in the `.env` file.
All of the secrets are auto generated if not set, but should be set manually in production. This is especially important for the session storage, as it won't be accessible anymore if the secret changes, for example, after a server restart.

If you need a reference how you could generate random secrets or keys, we created an example as a starting point: [Secrets generation example](https://stackblitz.com/edit/nuxt-oidc-auth-keygen?file=index.js)

- NUXT_OIDC_TOKEN_KEY (random key): This needs to be a random cryptographic AES key in base64. Used to encrypt the server side token store. You can generate a key in JS with `await subtle.exportKey('raw', await subtle.generateKey({ name: 'AES-GCM', length: 256, }, true, ['encrypt', 'decrypt']))`. You just have to encode it to base64 afterwards.
- NUXT_OIDC_SESSION_SECRET (random string): This should be a at least 48 characters random string. It is used to encrypt the user session.
- NUXT_OIDC_AUTH_SESSION_SECRET (random string): This should be a at least 48 characters random string. It is used to encrypt the individual sessions during OAuth flows.

Add a `NUXT_OIDC_SESSION_SECRET` env variable with at least 48 characters in the `.env` file.

```ini
# .env
NUXT_OIDC_TOKEN_KEY=base64_encoded_key
NUXT_OIDC_SESSION_SECRET=48_characters_random_string
NUXT_OIDC_AUTH_SESSION_SECRET=48_characters_random_string
```

✨ That's it! You can now add authentication with a predifined provider or a custom OIDC provider to your Nuxt app ✨

## Supported OpenID Connect Providers

Nuxt OIDC Auth includes presets for the following providers with tested default values:

- Auth0
- GitHub
- Keycloak
- Microsoft
- Microsoft Entra ID (previously Azure AD)
- Microsoft Entra ID for Customers (successor of AAD B2C)
- Generic OIDC

You can add a generic OpenID Connect provider by using the `oidc` provider key in the configuration. Remember to set the required fields and expect your provider to behave slightly different than defined in the OAuth and OIDC specifications.
For security reasons, you should avoid writing the client secret directly in the `nuxt.config.ts` file. You can use environment variables to inject settings into the runtime config. Check the `.env.example` file in the playground folder for an example.

```ini
# OIDC MODULE CONFIG
NUXT_OIDC_TOKEN_KEY=
NUXT_OIDC_SESSION_SECRET=
NUXT_OIDC_AUTH_SESSION_SECRET=
# AUTH0 PROVIDER CONFIG
NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET=
NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID=
NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL=
# KEYCLOAK PROVIDER CONFIG
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET=
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID=
NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL=
...
```

## Remarks

This module only implements the `Authorization Code Flow` and optionally the `Hybrid Flow` in a confidential client scenario as detailed in the [OpenID Connect specification](https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth).
We will not support the `Implicit Flow` in the future, as it should not be used anymore and was practically superseded by the `Authorization Code Flow`.
We will also not support the `Client Credential Flow`, as it is not part of OIDC, but of OAuth2 and is correctly named `Client Credentials Grant`. It is basically just an exchange of credentials for a token, is not meant for user authentication and can easily be implemented using a simple `fetch` request.

This module only works with SSR (server-side rendering) enabled as it uses server API routes. You cannot use this module with `nuxt generate`.

## Vue Composable

Nuxt OIDC Auth automatically adds some API routes to interact with the current user session and adds the `useOidcAuth` composable, which provides the following refs and methods to access the session from your Vue components:

- `loggedIn`
- `user`
- `currentProvider`
- `fetch`
- `refresh`
- `login`
- `logout`

### `loggedIn` => (boolean)

Indicates whether the user is currently logged in.

Example usage:

```js
const { loggedIn } = useOidcAuth()

if (loggedIn.value) {
  console.log('User is logged in')
}
else {
  console.log('User is not logged in')
}
```

### `login(provider?: ProviderKeys | 'dev', params?: Record<string, string>)` => (Promise<void>)

Initiates the login process.

**Parameters**

| Name | Description |
|---|---|
| provider | The authentication provider to use. If not specified, uses the default provider. |
| params | Additional parameters to include in the login request. Each parameters has to be listed in 'allowedClientAuthParameters' in the provider configuration. |

Example usage:

```vue
<script setup>
const { loggedIn, user, login, logout } = useOidcAuth()
</script>

<template>
  <div v-if="loggedIn">
    <h1>Welcome {{ user.userName }}!</h1>
    <p>Logged in since {{ user.loggedInAt }}</p>
    <button @click="logout()">
      Logout
    </button>
  </div>
  <div v-else>
    <h1>Not logged in</h1>
    <a href="/auth/github/login">Login with GitHub</a>
    <button @click="login()">
      Login with default provider
    </button>
  </div>
</template>
```

### `user` => (object)

The current user object.

### `currentProvider` => (string)

The name of the currently logged in provider.

### `fetch()` => (void)

Fetches/updates the current user session.

### `refresh()` => (void)

Refreshes the current user session against the used provider to get a new access token. Only available if the current provider issued a refresh token (indicated by `canRefresh` property in the `user` object).

### `logout(provider: string)` => (Promise<void>)

Handles the logout process. Always provide the optional `provider` parameter if you haven't set a default provider. You can get the current provider from the `currentProvider` property.

Example usage:

```vue
<script setup>
const { logout } = useOidcAuth()
</script>

<template>
  <button @click="logout()">
    Logout
  </button>
</template>
```

Example usage with no default provider configured or middleware `customLoginPage` set to `true`:

```vue
<script setup>
const { logout, currentProvider } = useOidcAuth()
</script>

<template>
  <button @click="logout(currentProvider)">
    Logout
  </button>
</template>
```

### User object

The `user` object provided by `useOidcAuth` contains the following properties:

| Name | Type | Description |
|---|---|---|
| provider | `string` | Name of the provider used to log in the current session |
| canRefresh | `boolean` | Whether the current session exposed a refresh token |
| loggedInAt | `number` | Login timestamp in second precision |
| updatedAt | `number` | Refresh timestamp in second precision |
| expireAt | `number` | Session expiration timestamp in second precision. Either `loggedInAt` plus session max age or expiration of access token if available. |
| userInfo | `Record<string, unknown>` | Additional information coming from the provider's userinfo endpoint |
| userName | `string` | Coming either from the provider or from the configured mapped claim |
| claims | `Record<string, unknown>` | Additional optional claims from the id token, if `optionalClaims` setting is configured. |
| accessToken | `string` | Exposed access token, only existent when `exposeAccessToken` is configured. |
| idToken | `string` | Exposed access token, only existent when `exposeIdToken` is configured. |

You can extend the type for your provider info by creating a type declaration file (for example, `auth.d.ts`) in your project:

```ts
declare module '#oidc-auth' {
  interface UserInfo {
    // define the type here e.g.,
    providerName: string
  }
}
```

## Server Utils

The following helpers are auto-imported in your `server/` directory.

### Middleware

This module can automatically add a global middleware to your Nuxt server. You can enable it by setting `globalMiddlewareEnabled` under the `middleware` section of the config.
The middleware automatically redirects all requests to `/auth/login` if the user is not logged in. You can disable this behavior by setting `redirect` to `false` in the `middleware` configuration.
The `/auth/login` route is only configured if you have defined a default provider. If you want to use a custom login page and keep your default provider or don't want to set a default provider at all, you can set `customLoginPage` to `true` in the `middleware` configuration.

If you set `customLoginPage` to `true`, you have to manually add a login page to your Nuxt app under `/auth/login`. You can use the `login` method from the `useOidcAuth` composable to redirect the user to the respective provider login page.
Setting `customLoginPage` to `true` will also disable the `/auth/logout` route. You have to manually add a logout page to your Nuxt app under `/auth/logout` and use the `logout` method from the `useOidcAuth` composable to logout the user or make sure that you always provide the optional `provider` parameter to the `logout` method.

```vue
<script setup>
const { logout, currentProvider } = useOidcAuth()
</script>

<template>
  <button @click="logout(currentProvider)">
    Logout
  </button>
</template>
```

⚠️ Everything under the `/auth` path is not protected by the global middleware. Make sure to not use this path for any other purpose than authentication.

### Session expiration and refresh

Nuxt OIDC Auth automatically checks if the session is expired and refreshes it if necessary. You can disable this behavior by setting `expirationCheck` and `automaticRefresh` to `false` in the `session` configuration.
The session is automatically refreshed when the `session` object is accessed. You can also manually refresh the session using `refresh` from `useOidcAuth` on the client or on the server side by calling `refreshUserSession(event)`.

Session expiration and refresh is handled completely server side, the exposed properties in the user session are automatically updated. You can theoretically register a hook that overwrites session fields like `loggedInAt`, but this is not recommended and will be overwritten with each refresh.

### OIDC Event Handlers

All configured providers automatically register the following server routes.

- `/auth/<provider>/callback`
- `/auth/<provider>/login`
- `/auth/<provider>/logout`

In addition, if `defaultProvider` is set, the following route rules are registered as forwards to the default provider.

- `/auth/login`
- `/auth/logout`

### Using the session in server side code

You can access the user session in your server side code by using the `getUserSession` function from the `@nuxtjs/oidc-auth` module.

```ts
import { getUserSession } from "nuxt-oidc-auth/runtime/server/utils/session.mjs"

export default eventHandler(async (event) => {
  const session = await getUserSession(event)
  return session.userName
})
```

Be careful to not expose any sensitive information from the handler code.

### Hooks

The following hooks are available to extend the default behavior of the OIDC module:

- `fetch` (Called when a user session is fetched)
- `clear` (Called before a user session is cleared)
- `refresh` (Called before a user session is refreshed)

⚠️ Remember to also update the refresh hook if you modify the session, as claims and other fields would otherwise be wiped.

#### Example

```ts
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    // Extend User Session
    // Or throw createError({ ... }) if session is invalid
    // session.extended = {
    //   fromHooks: true
    // }
    console.log('Injecting "status" claim as test')
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { status: 'Fetch' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
  })

  sessionHooks.hook('refresh', async (session) => {
    console.log('Injecting "status" claim as test on refresh')
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { status: 'Refresh' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
  })

  sessionHooks.hook('clear', async (session) => {
    // Log that user logged out
    console.log('User logged out')
  })
})
```

You can theoretically register a hook that overwrites internal session fields like `loggedInAt`, but this is not recommended as it has an impact on the `loggedIn` state of your session. It will not impact the server side refresh and expiration logic, but will be overwritten with each refresh.

## Configuration reference

The configuration for this module can be defined in your `nuxt.config.ts` file:

```ts
export default defineNuxtConfig({
  oidc: {
    defaultProvider: '<provider>',
    providers: {
      <provider>: {
        clientId: '...',
        clientSecret: '...'
      }
    },
    middleware: {
      globalMiddlewareEnabled: true,
      customLoginPage: false
    }
  }
})
```

### `oidc`

| Option | Type | Default | Description |
|---|---|---|---|
| enabled | `boolean` | - | Enables/disables the module |
| defaultProvider | `string` | - | Sets the default provider. Enables automatic registration of generic `/auth/login` and `/auth/logout` route rules |
| [providers](#providers) | `<provider>` | - | Configuration entries for each configured provider. For provider specific config see *Provider specific configurations* |
| [session](#session) | `AuthSessionConfig` | - | Optional session specific configuration |
| [middleware](#middleware) | `MiddlewareConfig` | - | Optional middleware specific configuration |
| [devMode](#dev-mode) | `DevModeConfig` | - | Configuration for local dev mode |
| provideDefaultSecrets | `boolean` | `true` | Provide defaults for NUXT_OIDC_SESSION_SECRET, NUXT_OIDC_TOKEN_KEY and NUXT_OIDC_AUTH_SESSION_SECRET using a Nitro plugin. Turning this off can lead to the app not working if no secrets are provided |

#### `providers`

`<provider>`

| Option | Type | Default | Description |
|---|---|---|---|
| clientId | `string` | - | Client ID |
| clientSecret | `string` | - | Client Secret |
| responseType | `'code'` \| `'code token'` \| `'code id_token'` \| `'id_token token'` \| `'code id_token token'` (optional) | `code` | Response Type |
| authenticationScheme | `'header'` \| `'body'` (optional) | `header` | Authentication scheme |
| responseMode | `'query'` \| `'fragment'` \| `'form_post'` \| `string` (optional) | - | Response mode for authentication request |
| authorizationUrl | `string` (optional) | - | Authorization endpoint URL |
| tokenUrl | `string` (optional) | - | Token endpoint URL |
| userInfoUrl | `string` (optional) | '' | Userinfo endpoint URL |
| redirectUri | `string` (optional) | - | Redirect URI |
| grantType | `'authorization_code'` \| 'refresh_token' (optional) | `authorization_code` | Grant Type |
| scope | `string[]` (optional) | `['openid']` | Scope |
| pkce | `boolean` (optional) | `false` | Use PKCE (Proof Key for Code Exchange) |
| state | `boolean` (optional) | `true` | Use state parameter with a random value. If state is not used, the nonce parameter is used to identify the flow. |
| nonce | `boolean` (optional) | false | Use nonce parameter with a random value. |
| userNameClaim | `string` (optional) | '' | User name claim that is used to get the user name from the access token as a fallback in case the userinfo endpoint is not provided or the userinfo request fails. |
| optionalClaims | `string[]` (optional) | - | Claims to be extracted from the id token |
| logoutUrl | `string` (optional) | '' | Logout endpoint URL |
| scopeInTokenRequest | `boolean` (optional) | false | Include scope in token request |
| tokenRequestType | `'form'` \| `'form-urlencoded'` \| `'json'` (optional) | `'form'` | Token request type |
| audience | `string` (optional) | - | Audience used for token validation (not included in requests by default, use additionalTokenParameters or additionalAuthParameters to add it) |
| requiredProperties | `string[]` | - | Required properties of the configuration that will be validated at runtime. |
| filterUserInfo | `string[]`(optional) | - | Filter userinfo response to only include these properties. |
| skipAccessTokenParsing | `boolean` (optional) | - | Skip access token parsing (for providers that don't follow the OIDC spec/don't issue JWT access tokens). |
| logoutRedirectParameterName | `string` (optional) | - | Query parameter name for logout redirect. Will be appended to the logoutUrl as a query parameter. |
| additionalAuthParameters | `Record<string, string>` (optional) | - | Additional parameters to be added to the authorization request. See [Provider specific configurations](#provider-specific-configurations) for possible parameters. |
| additionalTokenParameters | `Record<string, string>` (optional) | - | Additional parameters to be added to the token request. See [Provider specific configurations](#provider-specific-configurations) for possible parameters. |
| baseUrl | `string` (optional) | - | Base URL for the provider, used when to dynamically create authorizationUrl, tokenUrl, userInfoUrl and logoutUrl if possible. |
| openIdConfiguration | `string` or `Record<string, unknown>` or `function (config) => Record<string, unknown>` (optional) | - | OpenID Configuration url, object or function promise that resolves to an OpenID Configuration object. |
| validateAccessToken | `boolean` (optional) | `true` | Validate access token. |
| validateIdToken | `boolean` (optional) | `true` | Validate id token. |
| encodeRedirectUri | `boolean` (optional) | `false` | Encode redirect uri query parameter in authorization request. Only for compatibility with services that don't implement proper parsing of query parameters. |
| exposeAccessToken | `boolean` (optional) | `false` | Expose access token to the client within session object |
| exposeIdToken | `boolean` (optional) | `false` | Expose raw id token to the client within session object
| callbackRedirectUrl | `string` (optional) | `/` | Set a custom redirect url to redirect to after a successful callback
| allowedClientAuthParameters | `string[]` (optional) | `[]` | List of allowed client-side user-added query parameters for the auth request
| sessionConfiguration | `ProviderSessionConfig` (optional) | `{}` | Session configuration overrides, see [session](#session)

#### `session`

The following options are available for the global session configuration.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| automaticRefresh | `boolean` | `true` | Automatically refresh access token and session if refresh token is available (indicated by `canRefresh` property on user object) |
| expirationCheck | `boolean` | `true` | Check if session is expired based on access token exp |
| expirationThreshold | `number` | `0` | Amount of seconds before access token expiration to trigger automatic refresh |
| maxAge | `number` | `60 * 60 * 24` (1 day) | Maximum auth session duration in seconds |
| cookie | `` | `` | Additional cookie setting overrides for `sameSite` and `secure` |

The following options are available on every provider as overrides for the global session configuration.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| automaticRefresh | `boolean` | `true` | Check if session is expired based on access token exp |
| expirationCheck | `boolean` | `true` | Automatically refresh access token and session if refresh token is available (indicated by `canRefresh` property on user object) |
| expirationThreshold | `number` | `0` | Amount of seconds before access token expiration to trigger automatic refresh |

#### `middleware`

| Option | Type | Default | Description |
|---|---|---|---|
| globalMiddlewareEnabled | boolean | - | Enables/disables the global middleware |
| customLoginPage | boolean | - | Enables/disables automatic registration of `/auth/login` and `/auth/logout` route rules |

## Provider specific configurations

Some providers have specific additional fields that can be used to extend the authorization or token request. These fields are available via. `additionalAuthParameters` or `additionalTokenParameters` in the provider configuration.

⚠️ Tokens will only be validated if the `clientId` or the optional `audience` field is part of the access_tokens audiences. Even if `validateAccessToken` or `validateIdToken` is set, if the audience doesn't match, the token should not and will not be validated.

The `redirectUri` property is always required.

### Auth0

**Provider support:**

✅&nbsp; PKCE<br>
❌&nbsp; Nonce<br>
✅&nbsp; State<br>
✅&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

**Instructions**

Additional parameters to be used in additionalAuthParameters,
 additionalTokenParameters or additionalLogoutParameters:

| Option | Type | Default | Description |
|---|---|---|---|
| connection | `string` | - | Optional. Forces the user to sign in with a specific connection. For example, you can pass a value of github to send the user directly to GitHub to log in with their GitHub account. When not specified, the user sees the Auth0 Lock screen with all configured connections. You can see a list of your configured connections on the Connections tab of your application. |
| organization   | `string` | - | Optional. ID of the organization to use when authenticating a user. When not provided, if your application is configured to Display Organization Prompt, the user will be able to enter the organization name when authenticating. |
| invitation | `string` | - | Optional. Ticket ID of the organization invitation. When inviting a member to an Organization, your application should handle invitation acceptance by forwarding the invitation and organization key-value pairs when the user accepts the invitation. |
| loginHint | `string` | - | Optional. Populates the username/email field for the login or signup page when redirecting to Auth0. Supported by the Universal Login experience. |
| audience | `string` | - | Optional. The unique identifier of the API your web app wants to access. |

Depending on the settings of your apps `Credentials` tab, set `authenticationScheme` to `body` for 'Client Secret (Post)', set to `header` for 'Client Secret (Basic)', set to `''` for 'None'

### AWS Cognito

**Provider support:**

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

AWS Congito doesn't correctly implement the OAuth 2 standard and doesn't provide a `aud` field for the audience. Therefore it is not possible to verify the access or id token.

**Instructions**

For AWS Cognito you have to provide at least the `baseUrl`, `clientId`, `clientSecret` and `logoutRedirectUri` properties. The `baseUrl` is used to dynamically create the `authorizationUrl`, `tokenUrl`, `logoutUrl` and `userInfoUrl`.
The only supported OAuth grant type is `Authorization code grant`.
The final url should look something like this `https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_SOMEID/.well-known/openid-configuration`.
You will also encounter an error, if you have not correctly registered the `redirectUri` under "Allowed callback URLs" or the `logoutRedirectUri` under "Allowed sign-out URLs".
If you need additional scopes, specify them in the `scope` property in you nuxt config like `scope: ['openid', 'email', 'profile'],`.

### Entra ID/Microsoft

**Provider support:**

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
✅&nbsp; State<br>
⚠️&nbsp; Access Token validation (Supported, but disabled as only possible for custom audience tokens)<br> 
✅&nbsp; ID Token validation<br>

**Instructions**

Additional parameters to be used in additionalAuthParameters,
 additionalTokenParameters or additionalLogoutParameters:

| Option | Type | Default | Description |
|---|---|---|---|
| resource | `string` | - | Optional. The resource identifier for the requested resource. |
| audience   | `string` | - | Optional. The audience for the token, typically the client ID. |
| prompt | `string` | - | Optional. Indicates the type of user interaction that is required. Valid values are login, none, consent, and select_account. |
| loginHint | `string` | - | Optional. You can use this parameter to pre-fill the username and email address field of the sign-in page for the user. Apps can use this parameter during reauthentication, after already extracting the login_hint optional claim from an earlier sign-in. |
| logoutHint | `string` | - | Optional. Enables sign-out to occur without prompting the user to select an account. To use logout_hint, enable the login_hint optional claim in your client application and use the value of the login_hint optional claim as the logout_hint parameter. |
| domainHint | `string` | - | Optional. If included, the app skips the email-based discovery process that user goes through on the sign-in page, leading to a slightly more streamlined user experience. |

If you want to validate access tokens from Microsoft Entra ID (previously Azure AD), you need to make sure that the scope includes your own API. You have to register an API first and expose some scopes to your App Registration that you want to request. If you only have GraphAPI entries like `openid`, `mail` GraphAPI specific ones in your scope, the returned access token cannot and should not be verified. If the scope is set correctly, you can set `validateAccessToken` option to `true`.

If you use this module with Entra External ID (previously Entra ID for Customers) make sure you have set the `audience` config field to your application id, otherwise it will not be possible to get a valid OpenID Connect well-known configuration and thereby verify the JWT token.

### GitHub

**Provider support:**

❌&nbsp; PKCE<br>
❌&nbsp; Nonce<br>
✅&nbsp; State<br>
❌&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

**Instructions**

GitHub is not strictly an OIDC provider, but it can be used as one. Make sure that validation is disabled and that you keep the `skipAccessTokenParsing` option to `true`.

Try to use a [GitHub App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps), not the legacy OAuth app. They don't provide the same level of security, have no granular permissions, don't provide refresh tokens and are not tested.

Make sure to set the callback URL in your OAuth app settings as `<your-domain>/auth/github`.

### Keycloak

**Provider support:**

✅&nbsp; PKCE<br>
✅&nbsp; Nonce<br>
❌&nbsp; State<br>
✅&nbsp; Access Token validation<br>
❌&nbsp; ID Token validation<br>

**Instructions**

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

## Dev mode

Since 0.10.0, there is a local dev mode available. It can only be enabled if the `NODE_ENV` environment variable is not set to `prod/production` AND dev mode is explicitly enabled in the config. The dev mode is for ***local*** and ***offline*** development and returns a static user object that can be configured in the config or by variables in `.env`.
The following fields in the returned [user object](#user-object) can be configured:

- `claims`: `devMode.claims` setting
- `provider`: `devMode.provider` setting
- `userName`: `devMode.userName` setting
- `userInfo`: `devMode.userInfo` setting
- `idToken`: `devMode.idToken` setting
- `accessToken`: `devMode.accessToken` setting

Please refer to [user object](#user-object) for required types.

### Enabling

To enable the dev mode, you have to make sure at least the following settings are set:

- `session` -> `expirationCheck` needs to be turned off (`false`)
- `devMode` -> `enabled` set to `true` in the `oidc` part of your `nuxt.config.ts`

### Token generation

If needed, the dev mode can generate a valid signed access token if the settting `devMode` -> `generateAccessToken` is set to `true`. This token will be exposed in the `user.accessToken` property.
The properties on the generated token are

- `iat` (issued at): current DateTime,
- `iss` (issuer): `devMode.issuer` setting, default `nuxt:oidc:auth:issuer`
- `aud`: `devMode.audience` setting, default `nuxt:oidc:auth:audience`
- `sub`: `devMode.subject` setting, default `nuxt:oidc:auth:subject`
- `exp`: current DateTime + 24h

⚠️ The access token will be generated with a fixed local secret and can in no way be considered secure. Dev mode can only be enabled in local development and should exclusively be used there for testing purposes. Never set any environment variables on your production systems that could put any component into development mode.

## Contributing

```bash
# Install dependencies
pnpm install

# Generate type stubs
pnpm run dev:prepare

# Develop with the playground
pnpm run dev

# Build the playground
pnpm run dev:build

# Run ESLint
pnpm run lint
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
