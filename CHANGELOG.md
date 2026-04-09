# Changelog


## v1.0.0-beta.11

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.10...v1.0.0-beta.11)

### 🩹 Fixes

- **config:** Reject empty, whitespace-only, and null values in validateConfig ([ada823a](https://github.com/itpropro/nuxt-oidc-auth/commit/ada823a))
- **session:** Slide cookie expiry forward on token refresh ([1e7f855](https://github.com/itpropro/nuxt-oidc-auth/commit/1e7f855))
- Tighten runtime typing and align callback redirect tests ([7fd2643](https://github.com/itpropro/nuxt-oidc-auth/commit/7fd2643))
- **types:** Align oidc module typing with Nuxt type contexts ([f0a22b2](https://github.com/itpropro/nuxt-oidc-auth/commit/f0a22b2))
- **runtime:** Tighten oidc flow and session handling ([9b238f5](https://github.com/itpropro/nuxt-oidc-auth/commit/9b238f5))
- **devmode:** Preserve callback redirect after dev login ([e3c085b](https://github.com/itpropro/nuxt-oidc-auth/commit/e3c085b))

### 📖 Documentation

- Add quickstart links and improve provider documentation ([35245c9](https://github.com/itpropro/nuxt-oidc-auth/commit/35245c9))

### 🏡 Chore

- **lint:** Fix all eslint errors ([7ac9233](https://github.com/itpropro/nuxt-oidc-auth/commit/7ac9233))
- **lint:** Migrate to oxlint + oxfmt pipeline ([2ff6a3d](https://github.com/itpropro/nuxt-oidc-auth/commit/2ff6a3d))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](https://github.com/itpropro))

## v1.0.0-beta.10

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.9...v1.0.0-beta.10)

### 🚀 Enhancements

- Restore original-url callback redirect with configured precedence ([3efe11e](https://github.com/itpropro/nuxt-oidc-auth/commit/3efe11e))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](https://github.com/itpropro))

## v1.0.0-beta.9

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.8...v1.0.0-beta.9)

## v1.0.0-beta.8

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.7...v1.0.0-beta.8)

### 🚀 Enhancements

- Added flag to clear stale sessions to avoid console log spam ([3d64e9c](https://github.com/itpropro/nuxt-oidc-auth/commit/3d64e9c))
- ⚠️  Add configurable session error behavior for server utils ([41ef1f7](https://github.com/itpropro/nuxt-oidc-auth/commit/41ef1f7))

### 🩹 Fixes

- Improved type safety; stale persistent session handling and docs ([9bd5472](https://github.com/itpropro/nuxt-oidc-auth/commit/9bd5472))

### ✅ Tests

- Added tests for stale persistent session; test cleanup ([42e425b](https://github.com/itpropro/nuxt-oidc-auth/commit/42e425b))

#### ⚠️ Breaking Changes

- ⚠️  Add configurable session error behavior for server utils ([41ef1f7](https://github.com/itpropro/nuxt-oidc-auth/commit/41ef1f7))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](https://github.com/itpropro))

## v1.0.0-beta.7

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.6...v1.0.0-beta.7)

### 🚀 Enhancements

- Added well-known endpoint with jwks to dev mode ([6b42412](https://github.com/itpropro/nuxt-oidc-auth/commit/6b42412))

### 🩹 Fixes

- Fixed redirect loop with dev mode ([afd3c5f](https://github.com/itpropro/nuxt-oidc-auth/commit/afd3c5f))

### 📖 Documentation

- Updated dev mode docs ([91f6ac5](https://github.com/itpropro/nuxt-oidc-auth/commit/91f6ac5))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](https://github.com/itpropro))

## v1.0.0-beta.6

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.5...v1.0.0-beta.6)

### 🚀 Enhancements

- **test:** Extended testing infrastructure ([3fc00ed](https://github.com/itpropro/nuxt-oidc-auth/commit/3fc00ed))
- Added new config setting cookieName to address #75 ([#75](https://github.com/itpropro/nuxt-oidc-auth/issues/75))

### 🩹 Fixes

- **zitadel:** Correcting provider for the playground ([#81](https://github.com/itpropro/nuxt-oidc-auth/pull/81))
- Fixed redirect behavior and added redirect to middleware + tests ([8efbe33](https://github.com/itpropro/nuxt-oidc-auth/commit/8efbe33))

### 💅 Refactors

- **proxy:** ♻️   Improved proxy handling and optional undici loading ([7329cea](https://github.com/itpropro/nuxt-oidc-auth/commit/7329cea))
- **proxy:** ♻️   Improved proxy handling and optional undici loading ([8620e2c](https://github.com/itpropro/nuxt-oidc-auth/commit/8620e2c))

### 📖 Documentation

- **docs:** ✏️   Added logto docs ([367c578](https://github.com/itpropro/nuxt-oidc-auth/commit/367c578))

### 🏡 Chore

- **release:** V1.0.0-beta.4 ([8ab06f8](https://github.com/itpropro/nuxt-oidc-auth/commit/8ab06f8))
- **release:** V1.0.0-beta.5 ([eb5285e](https://github.com/itpropro/nuxt-oidc-auth/commit/eb5285e))
- **release:** V1.0.0-beta.4 ([767e2df](https://github.com/itpropro/nuxt-oidc-auth/commit/767e2df))
- **release:** V1.0.0-beta.5 ([bc044d9](https://github.com/itpropro/nuxt-oidc-auth/commit/bc044d9))
- Upgraded deps/refs ([18eb5db](https://github.com/itpropro/nuxt-oidc-auth/commit/18eb5db))
- Fixed lint errors ([9463696](https://github.com/itpropro/nuxt-oidc-auth/commit/9463696))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](https://github.com/itpropro))
- Titouan-joseph Cicorella <titouanjoseph@gmail.com>

## v1.0.0-beta.5

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.4...v1.0.0-beta.5)

### 💅 Refactors

- **proxy:** ♻️   Improved proxy handling and optional undici loading ([7329cea](https://github.com/itpropro/nuxt-oidc-auth/commit/7329cea))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v1.0.0-beta.4

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.3...v1.0.0-beta.4)

### 🚀 Enhancements

- **provider:** ✨   Added logto provider ([a881f94](https://github.com/itpropro/nuxt-oidc-auth/commit/a881f94))
- **session:** ✨   Added single sign-out for the same session ([b04c16e](https://github.com/itpropro/nuxt-oidc-auth/commit/b04c16e))
- **session:** ✨   Added server side session invalidation and single sign-out ([81fdf72](https://github.com/itpropro/nuxt-oidc-auth/commit/81fdf72))
- **test:** ✅   Extended E2E test suite ([6ec7beb](https://github.com/itpropro/nuxt-oidc-auth/commit/6ec7beb))
- **middleware:** ✨   Added capability to disable auth per page with definePageMeta ([af99367](https://github.com/itpropro/nuxt-oidc-auth/commit/af99367))

### 🩹 Fixes

- **provider:** 🐛   Fixed domain_hint type ([be9dec3](https://github.com/itpropro/nuxt-oidc-auth/commit/be9dec3))
- **provider:** 🐛   Handled edge case where idToken in session could be undefined ([49f542b](https://github.com/itpropro/nuxt-oidc-auth/commit/49f542b))
- **provider:** Improved handling for unset audience in Entra provider ([58d34ff](https://github.com/itpropro/nuxt-oidc-auth/commit/58d34ff))
- **session:** 🐛   Handled logout redirect edge case with single sign out ([e68a527](https://github.com/itpropro/nuxt-oidc-auth/commit/e68a527))

### 💅 Refactors

- **deps:** ➕   Made undici a peer dependency ([fee50c9](https://github.com/itpropro/nuxt-oidc-auth/commit/fee50c9))

### 📖 Documentation

- 📝 point import in server side session example code to .js instead of .mjs file ([#93](https://github.com/itpropro/nuxt-oidc-auth/pull/93), [#94](https://github.com/itpropro/nuxt-oidc-auth/pull/94))
- **docs:** ✏️   Added logto and single sign-out docs entries ([70ca44b](https://github.com/itpropro/nuxt-oidc-auth/commit/70ca44b))

### ✅ Tests

- **e2e:** ✅   Added single sign-out tests ([478f607](https://github.com/itpropro/nuxt-oidc-auth/commit/478f607))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))
- Isaac ([@ImBoop](http://github.com/ImBoop))
- Bart Veraart ([@beerdeaap](http://github.com/beerdeaap))

## v1.0.0-beta.3

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.2...v1.0.0-beta.3)

### 🚀 Enhancements

- **config:** ✨   Proxy support for fetching and refreshing tokens ([9dd0e6a](https://github.com/itpropro/nuxt-oidc-auth/commit/9dd0e6a))
- **config:** ✨   Made temporary auth cookie expiration configurable ([ad9d21f](https://github.com/itpropro/nuxt-oidc-auth/commit/ad9d21f))
- **flow:** ✨   Added configurable redirect uris ([a9e393b](https://github.com/itpropro/nuxt-oidc-auth/commit/a9e393b))

### 🔥 Performance

- **docs:** 🔍️   Seo improvements ([1c41ec6](https://github.com/itpropro/nuxt-oidc-auth/commit/1c41ec6))

### 🩹 Fixes

- **docs:** 🐛   Fixed fonts config ([69bd0ad](https://github.com/itpropro/nuxt-oidc-auth/commit/69bd0ad))
- **fetching:** 🐛   Fixed a nuxt resolve bug with custom fetch ([9f720c5](https://github.com/itpropro/nuxt-oidc-auth/commit/9f720c5))

### 💅 Refactors

- **composable:** ♻️   Improved composable and SSR capabilities ([26b2fec](https://github.com/itpropro/nuxt-oidc-auth/commit/26b2fec))

### 📖 Documentation

- **docs:** ✏️   Updated KeyCloak docs ([b3c4087](https://github.com/itpropro/nuxt-oidc-auth/commit/b3c4087))
- 📝 Removed oidc logo and seo improvements ([#77](https://github.com/itpropro/nuxt-oidc-auth/pull/77))
- **playground:** ✏️   Added playground examples for custom redirect uri ([405c668](https://github.com/itpropro/nuxt-oidc-auth/commit/405c668))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v1.0.0-beta.2

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.1...v1.0.0-beta.2)

### 🚀 Enhancements

- **provider:** ✨   Added Microsoft provider ([3f2519d](https://github.com/itpropro/nuxt-oidc-auth/commit/3f2519d))

### 📖 Documentation

- **provider:** ✏️   Added docs for Microsoft provider ([e79f856](https://github.com/itpropro/nuxt-oidc-auth/commit/e79f856))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v1.0.0-beta.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v1.0.0-beta.0...v1.0.0-beta.1)

## v1.0.0-beta.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.18.0...v1.0.0-beta.0)

### 🚀 Enhancements

- **provider:** ✨   Added PayPal provider ([b7f8b07](https://github.com/itpropro/nuxt-oidc-auth/commit/b7f8b07))

### 💅 Refactors

- **structure:** ♻️   Reorganized handlers ([6eca959](https://github.com/itpropro/nuxt-oidc-auth/commit/6eca959))

### 📖 Documentation

- **readme:** ✏️   Updated Zitadel feature support ([4ff91f2](https://github.com/itpropro/nuxt-oidc-auth/commit/4ff91f2))
- **docs:** ✏️   Added dedicated docs ([2c06628](https://github.com/itpropro/nuxt-oidc-auth/commit/2c06628))
- **docs:** ✏️   Updated PayPal docs ([dfdc15f](https://github.com/itpropro/nuxt-oidc-auth/commit/dfdc15f))

### 🏡 Chore

- **lint:** 🚨   Updated linter config ([8a489e4](https://github.com/itpropro/nuxt-oidc-auth/commit/8a489e4))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.18.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.17.0...v0.18.0)

### 🚀 Enhancements

- **provider:** ✨   Added Zitadel provider ([e3a9ad2](https://github.com/itpropro/nuxt-oidc-auth/commit/e3a9ad2))
- **validation:** ✨   Improved aud field handling in validation process ([b0e8bec](https://github.com/itpropro/nuxt-oidc-auth/commit/b0e8bec))

### 💅 Refactors

- **encoding:** ♻️   Replaced encoding implementation with undio functions ([b295030](https://github.com/itpropro/nuxt-oidc-auth/commit/b295030))
- **token:** ♻️   Improved token validation ([6f70645](https://github.com/itpropro/nuxt-oidc-auth/commit/6f70645))

### 📖 Documentation

- **readme:** ✏️   Added Zitadel documentation; Updated structure ([40b8477](https://github.com/itpropro/nuxt-oidc-auth/commit/40b8477))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.17.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.16.0...v0.17.0)

### 🚀 Enhancements

- **session:** ✨   Tokens are now exposed via. userdata not in session cookie ([3b28a3f](https://github.com/itpropro/nuxt-oidc-auth/commit/3b28a3f))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.16.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.15.1...v0.16.0)

### 🚀 Enhancements

- **oidc:** ✨   Added handling for providers that don't refresh the refresh token ([55230a2](https://github.com/itpropro/nuxt-oidc-auth/commit/55230a2))
- **oidc:** ✨   Added per provider session configuration ([20c92ef](https://github.com/itpropro/nuxt-oidc-auth/commit/20c92ef))
- **config:** ⚠️  💥   Changed providerInfo to userInfo to align with oidc naming ([caa9781](https://github.com/itpropro/nuxt-oidc-auth/commit/caa9781))
- **oidc:** ✨   Added additionalLogoutParameters property to customize the logout redirect ([8605ba4](https://github.com/itpropro/nuxt-oidc-auth/commit/8605ba4))
- **provider:** ✨   Added AWS Cognito provider ([3da9e5d](https://github.com/itpropro/nuxt-oidc-auth/commit/3da9e5d))

### 📖 Documentation

- **provider:** ✏️   Added AWS Cognito; Updated providers section ([1e18b15](https://github.com/itpropro/nuxt-oidc-auth/commit/1e18b15))

#### ⚠️ Breaking Changes

- **config:** ⚠️  💥   Changed providerInfo to userInfo to align with oidc naming ([caa9781](https://github.com/itpropro/nuxt-oidc-auth/commit/caa9781))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.15.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.15.0...v0.15.1)

### 🩹 Fixes

- **composable:** 🐛   Fixed currentProvider reference on logout ([64a2fa1](https://github.com/itpropro/nuxt-oidc-auth/commit/64a2fa1))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.15.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.14.2...v0.15.0)

### 🚀 Enhancements

- **composable:** ✨   Added logoutRedirectUri for custom post logout redirects ([322b01d](https://github.com/itpropro/nuxt-oidc-auth/commit/322b01d))
- **session:** ✨   Updated refresh to include session and added refresh hook ([bb8f159](https://github.com/itpropro/nuxt-oidc-auth/commit/bb8f159))

### 💅 Refactors

- **composable:** ♻️   Made login detection more reliable ([5e63755](https://github.com/itpropro/nuxt-oidc-auth/commit/5e63755))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.14.2

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.14.1...v0.14.2)

### 💅 Refactors

- **routing:** ♻️   Optimized redirect handling ([73c366e](https://github.com/itpropro/nuxt-oidc-auth/commit/73c366e))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.14.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.14.0...v0.14.1)

### 🩹 Fixes

- **routes:** ⚡️   Replaced handler type ([0f03ded](https://github.com/itpropro/nuxt-oidc-auth/commit/0f03ded))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.14.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.13.0...v0.14.0)

### 🚀 Enhancements

- **refactor:** ✨   Deprecated requireUserSession; Internal refactoring ([68d98ff](https://github.com/itpropro/nuxt-oidc-auth/commit/68d98ff))
- **devtools:** ✨   Added provider choice; UI improvements ([502f2c6](https://github.com/itpropro/nuxt-oidc-auth/commit/502f2c6))
- **login:** ✨   Added capability to add custom query params from client ([956c010](https://github.com/itpropro/nuxt-oidc-auth/commit/956c010))

### 🏡 Chore

- Indicate compatibility with new v4 major ([#38](https://github.com/itpropro/nuxt-oidc-auth/pull/38))
- **config:** 🔧   Changed eslint config ([da87e05](https://github.com/itpropro/nuxt-oidc-auth/commit/da87e05))
- **types:** 🏷️   Improved typings ([d220149](https://github.com/itpropro/nuxt-oidc-auth/commit/d220149))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))
- Daniel Roe ([@danielroe](http://github.com/danielroe))

## v0.13.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.12.1...v0.13.0)

### 🚀 Enhancements

- Allow users to define custom provider info types ([4503100](https://github.com/itpropro/nuxt-oidc-auth/commit/4503100))
- **callback:** ✨   Introduced callbackRedirectUrl to customize after callback redirection ([64f82ed](https://github.com/itpropro/nuxt-oidc-auth/commit/64f82ed))

### 💅 Refactors

- **devmode:** ♻️   Adjusted devmode filter to exclude prod ([a4af66b](https://github.com/itpropro/nuxt-oidc-auth/commit/a4af66b))

### 📖 Documentation

- **nitro:** ✏️   Added example for session usage on the server side ([e891b91](https://github.com/itpropro/nuxt-oidc-auth/commit/e891b91))

### ❤️ Contributors

- Jan-Henrik Damaschke <jdamaschke@visorian.com>
- Reuben

## v0.12.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.12.0...v0.12.1)

### 🩹 Fixes

- Added useStorage optional chaining and types ([090320e](https://github.com/itpropro/nuxt-oidc-auth/commit/090320e))
- **session:** 🐛 Remove 'removeMeta' while removing an item from storage ([bb5fb5e](https://github.com/itpropro/nuxt-oidc-auth/commit/bb5fb5e))
- **debug:** 🔇   Added page extend to remove vue router warning ([5a8b76e](https://github.com/itpropro/nuxt-oidc-auth/commit/5a8b76e))

### 🎨 Styles

- **eslint:** 🎨   Updated eslint configs and fixed all style issues ([b7a67b2](https://github.com/itpropro/nuxt-oidc-auth/commit/b7a67b2))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))
- Abhishek Krishna ([@AbhishekKrishna123](http://github.com/AbhishekKrishna123))
- Dallas Hoffman ([@DallasHoff](http://github.com/DallasHoff))

## v0.12.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.11.1...v0.12.0)

### 🚀 Enhancements

- **oidc:** Support form-urlencoded token requests ([30ffe23](https://github.com/itpropro/nuxt-oidc-auth/commit/30ffe23))
- **devtools:** ✨   Added devauth check; Updated UI ([6cc3605](https://github.com/itpropro/nuxt-oidc-auth/commit/6cc3605))

### 🩹 Fixes

- **token-request:** 🐛   Updated implementation to account for ofetch behavior ([2196bff](https://github.com/itpropro/nuxt-oidc-auth/commit/2196bff))

### 📖 Documentation

- Use new `nuxi module add` command in installation ([4a910f4](https://github.com/itpropro/nuxt-oidc-auth/commit/4a910f4))
- **readme:** ✏️   Restructured docs ([71dad39](https://github.com/itpropro/nuxt-oidc-auth/commit/71dad39))
- **readme:** ✏️   Updated linebreaks ([7dc8bc6](https://github.com/itpropro/nuxt-oidc-auth/commit/7dc8bc6))
- **readme:** Reordered and fixed typos ([4ee7fa7](https://github.com/itpropro/nuxt-oidc-auth/commit/4ee7fa7))

### ❤️ Contributors

- Itpropro ([@itpropro](http://github.com/itpropro))
- Dallas Hoffman ([@DallasHoff](http://github.com/DallasHoff))
- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))
- Daniel Roe ([@danielroe](http://github.com/danielroe))

## v0.11.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.11.0...v0.11.1)

### 🩹 Fixes

- **devtools:** 🐛   Handled undefined state for devMode ([8ab934d](https://github.com/itpropro/nuxt-oidc-auth/commit/8ab934d))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.11.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.10.1...v0.11.0)

### 🚀 Enhancements

- **devmode:** ✨   Added dynamic generation of (a)symmetric JWT signing keys ([23b9253](https://github.com/itpropro/nuxt-oidc-auth/commit/23b9253))
- **devtools:** ✨   Added Nuxt devtools integration ([d7a3098](https://github.com/itpropro/nuxt-oidc-auth/commit/d7a3098))
- **expiration-check:** ✨   Made expirationCheck apply even if there is no refresh_token ([332dc17](https://github.com/itpropro/nuxt-oidc-auth/commit/332dc17))
- **composables:** ✨   Added clear composable ([2fb6cc9](https://github.com/itpropro/nuxt-oidc-auth/commit/2fb6cc9))

### 🩹 Fixes

- **devtools:** 🐛   Handled null state for auth session ([2d5617b](https://github.com/itpropro/nuxt-oidc-auth/commit/2d5617b))

### 📖 Documentation

- Added banner ([23795ad](https://github.com/itpropro/nuxt-oidc-auth/commit/23795ad))

### 🏡 Chore

- **ci:** 💚   Added implicit build command to module builder ([d962d42](https://github.com/itpropro/nuxt-oidc-auth/commit/d962d42))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.10.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.10.0...v0.10.1)

### 🩹 Fixes

- **nitro:** 🐛   Added missing defineNitroPlugin nitro import ([8c3002a](https://github.com/itpropro/nuxt-oidc-auth/commit/8c3002a))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.10.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.11...v0.10.0)

### 🚀 Enhancements

- **session:** ✨   Added new exposeIdToken setting ([29ffced](https://github.com/itpropro/nuxt-oidc-auth/commit/29ffced))
- **dev-mode:** ✨   Implemented dev mode for local development ([74cadf8](https://github.com/itpropro/nuxt-oidc-auth/commit/74cadf8))

### 💅 Refactors

- **secret-defaults:** ♻️   Refactored logic to provide default secrets ([45dd1da](https://github.com/itpropro/nuxt-oidc-auth/commit/45dd1da))

### 📖 Documentation

- **readme:** ✏️   Added an example for secrets and key generation ([1a26d0c](https://github.com/itpropro/nuxt-oidc-auth/commit/1a26d0c))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))
- Itpropro ([@itpropro](http://github.com/itpropro))

## v0.9.11

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.10...v0.9.11)

### 🏡 Chore

- **package:** 📦️   Removed unneeded configs from package.json ([ba4dd1e](https://github.com/itpropro/nuxt-oidc-auth/commit/ba4dd1e))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.10

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.9...v0.9.10)

### 🩹 Fixes

- **imports:** 🐛   Added missing import useRuntimeConfig import ([4b59bdd](https://github.com/itpropro/nuxt-oidc-auth/commit/4b59bdd))
- **imports:** 🐛   Implemented fix for unresolved runtimeConfig ([dc48114](https://github.com/itpropro/nuxt-oidc-auth/commit/dc48114))

### 🏡 Chore

- **release:** V0.9.10 ([28f3037](https://github.com/itpropro/nuxt-oidc-auth/commit/28f3037))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.9

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.8...v0.9.9)

### 💅 Refactors

- **logging:** ♻️   Removed unneeded log ([7d221fa](https://github.com/itpropro/nuxt-oidc-auth/commit/7d221fa))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.8

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.7...v0.9.8)

### 🚀 Enhancements

- **session:** ✨   Added expirationThreshold setting ([9933b8e](https://github.com/itpropro/nuxt-oidc-auth/commit/9933b8e))

### 💅 Refactors

- **logging:** ♻️   Improved logging ([171b63c](https://github.com/itpropro/nuxt-oidc-auth/commit/171b63c))

### 🏡 Chore

- **build:** 💚   Updated build config ([b5bd501](https://github.com/itpropro/nuxt-oidc-auth/commit/b5bd501))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.7

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.6...v0.9.7)

### 🚀 Enhancements

- **config:** 🔧   Added more secure default for session cookie config ([7fe41ab](https://github.com/itpropro/nuxt-oidc-auth/commit/7fe41ab))
- **provider:** ✨   Added Entra prompt parameter to config ([07a5cf6](https://github.com/itpropro/nuxt-oidc-auth/commit/07a5cf6))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.6

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.5...v0.9.6)

### 🚀 Enhancements

- **oidc:** ✨   Improved callback error handling ([cc9c012](https://github.com/itpropro/nuxt-oidc-auth/commit/cc9c012))
- **provider:** ✨   Added resource and audience to Entra provider ([ba0f07a](https://github.com/itpropro/nuxt-oidc-auth/commit/ba0f07a))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.5

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.4...v0.9.5)

### 🚀 Enhancements

- **session:** ✨   Added exposeAccessToken setting; Exposed expireAt property ([4162eda](https://github.com/itpropro/nuxt-oidc-auth/commit/4162eda))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.4

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.3...v0.9.4)

### 🩹 Fixes

- **hooks:** 🐛   Removed duplicate refresh hook call ([0bfa7a3](https://github.com/itpropro/nuxt-oidc-auth/commit/0bfa7a3))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.3

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.2...v0.9.3)

### 🩹 Fixes

- **imports:** ♻️   Added missing useRuntimeConfig import for token refresh ([90c2524](https://github.com/itpropro/nuxt-oidc-auth/commit/90c2524))

### 📖 Documentation

- **readme:** ✏️   Fixed broken oidc provider link ([46499d9](https://github.com/itpropro/nuxt-oidc-auth/commit/46499d9))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.2

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.1...v0.9.2)

### 🚀 Enhancements

- **config:** ✨   Added encodeRedirectUri parameter ([3d0a417](https://github.com/itpropro/nuxt-oidc-auth/commit/3d0a417))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.9.0...v0.9.1)

### 🩹 Fixes

- **session:** 🐛   Added missing h3 import ([04c1361](https://github.com/itpropro/nuxt-oidc-auth/commit/04c1361))

### 📖 Documentation

- **readme:** Updated readme ([d6fb470](https://github.com/itpropro/nuxt-oidc-auth/commit/d6fb470))

### 🤖 CI

- Add Azure Static Web Apps workflow file on-behalf-of: @Azure opensource@microsoft.com ([ab18f20](https://github.com/itpropro/nuxt-oidc-auth/commit/ab18f20))
- **ci:** 💚   Prepare for playground swa deployment ([6cdfafe](https://github.com/itpropro/nuxt-oidc-auth/commit/6cdfafe))
- **ci:** 💚   Updated ci workflow ([7c51f8b](https://github.com/itpropro/nuxt-oidc-auth/commit/7c51f8b))
- **ci:** 💚   Updated ci workflow ([1b00407](https://github.com/itpropro/nuxt-oidc-auth/commit/1b00407))
- **ci:** 💚   Updated ci workflow ([e2f1aaf](https://github.com/itpropro/nuxt-oidc-auth/commit/e2f1aaf))
- **ci:** 💚   Updated ci workflow ([9346a9e](https://github.com/itpropro/nuxt-oidc-auth/commit/9346a9e))
- **ci:** 💚   Updated ci workflow ([95d7bc1](https://github.com/itpropro/nuxt-oidc-auth/commit/95d7bc1))
- **ci:** 💚   Updated ci workflow ([573745b](https://github.com/itpropro/nuxt-oidc-auth/commit/573745b))
- **ci:** 💚   Updated ci workflow ([bc572d3](https://github.com/itpropro/nuxt-oidc-auth/commit/bc572d3))
- **ci:** 💚   Ci ([9329651](https://github.com/itpropro/nuxt-oidc-auth/commit/9329651))
- **ci:** 💚   Updated workflow ([acd54b4](https://github.com/itpropro/nuxt-oidc-auth/commit/acd54b4))
- **ci:** 💚   Updated workflow ([3df0073](https://github.com/itpropro/nuxt-oidc-auth/commit/3df0073))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.9.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.8.0...v0.9.0)

### 🚀 Enhancements

- **provider:** ✨   Added Keycloak provider; Session improvements ([ffa2d92](https://github.com/itpropro/nuxt-oidc-auth/commit/ffa2d92))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.8.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.9...v0.8.0)

### 📖 Documentation

- **readme:** ✏️   Updated badges ([582bcf7](https://github.com/itpropro/nuxt-oidc-auth/commit/582bcf7))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.9

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.5...v0.7.9)

### 🚀 Enhancements

- **types:** 🏷️   Improved typings for config and composables ([2c64e57](https://github.com/itpropro/nuxt-oidc-auth/commit/2c64e57))
- **oidc:** ✨   Added optional `prompt` parameter to auth request ([a77687b](https://github.com/itpropro/nuxt-oidc-auth/commit/a77687b))
- **session:** ✨   Added persistent session storage cleanup; Improved log outputs ([f171583](https://github.com/itpropro/nuxt-oidc-auth/commit/f171583))

### 🩹 Fixes

- **imports:** 🐛   Added missing h3 import for logout handler ([d32260d](https://github.com/itpropro/nuxt-oidc-auth/commit/d32260d))

### 🏡 Chore

- **release:** V0.7.6 ([7e8743c](https://github.com/itpropro/nuxt-oidc-auth/commit/7e8743c))
- **release:** V0.7.7 ([815a5a8](https://github.com/itpropro/nuxt-oidc-auth/commit/815a5a8))
- **name:** 🚚   Removed package scope ([0b0875a](https://github.com/itpropro/nuxt-oidc-auth/commit/0b0875a))
- **release:** V0.7.8 ([9eb5c7e](https://github.com/itpropro/nuxt-oidc-auth/commit/9eb5c7e))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.8

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.7...v0.7.8)

### 🏡 Chore

- **name:** 🚚   Removed package scope ([cfb66cf](https://github.com/itpropro/nuxt-oidc-auth/commit/cfb66cf))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.7

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.6...v0.7.7)

### 🚀 Enhancements

- **types:** 🏷️   Improved typings for config and composables ([85309de](https://github.com/itpropro/nuxt-oidc-auth/commit/85309de))
- **oidc:** ✨   Added optional `prompt` parameter to auth request ([5285933](https://github.com/itpropro/nuxt-oidc-auth/commit/5285933))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.6

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.5...v0.7.6)

### 🩹 Fixes

- **imports:** 🐛   Added missing h3 import for logout handler ([d32260d](https://github.com/itpropro/nuxt-oidc-auth/commit/d32260d))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.5

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.4...v0.7.5)

### 🩹 Fixes

- **imports:** ♻️   Added additional explicit h3 imports ([5a2edc1](https://github.com/itpropro/nuxt-oidc-auth/commit/5a2edc1))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.4

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.3...v0.7.4)

### ✅ Tests

- **test:** ✅   Setting up tests ([8a3c54a](https://github.com/itpropro/nuxt-oidc-auth/commit/8a3c54a))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.3

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.2...v0.7.3)

### 🚀 Enhancements

- **composables:** 🔥   Deprecated configuredProviders property ([9acfea5](https://github.com/itpropro/nuxt-oidc-auth/commit/9acfea5))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.2

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.1...v0.7.2)

### 💅 Refactors

- **imports:** ♻️   Added explicit utils h3 import ([586116b](https://github.com/itpropro/nuxt-oidc-auth/commit/586116b))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.1

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.7.0...v0.7.1)

### 💅 Refactors

- **imports:** ♻️   Added explicit h3 imports ([ba112fb](https://github.com/itpropro/nuxt-oidc-auth/commit/ba112fb))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.7.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.6.0...v0.7.0)

### 💅 Refactors

- **imports:** ♻️   Added explicit h3 import ([0779de0](https://github.com/itpropro/nuxt-oidc-auth/commit/0779de0))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.6.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.5.0...v0.6.0)

### 🩹 Fixes

- **handler:** 🐛   Fixed handler imports ([78b989d](https://github.com/itpropro/nuxt-oidc-auth/commit/78b989d))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.5.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.4.0...v0.5.0)

### 🩹 Fixes

- **resolve:** 🐛   Fixed wrong middleware resolver reference ([8a275c2](https://github.com/itpropro/nuxt-oidc-auth/commit/8a275c2))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.4.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.3.0...v0.4.0)

### 🩹 Fixes

- **imports:** 🐛   Fixed import bugs ([11b3d28](https://github.com/itpropro/nuxt-oidc-auth/commit/11b3d28))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.3.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.2.0...v0.3.0)

### 📖 Documentation

- **readme:** ✏️   Updated npm and playgrounds references ([af72204](https://github.com/itpropro/nuxt-oidc-auth/commit/af72204))

### 🏡 Chore

- **package:** 📦️   Updated package json ([85f5428](https://github.com/itpropro/nuxt-oidc-auth/commit/85f5428))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))

## v0.2.0

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/6b924f7ea7037a3af861cbba82244892ff5e61f6...v0.2.0)

### 🚀 Enhancements

- **jwt:** ✨   Added optional token validation ([39fea17](https://github.com/itpropro/nuxt-oidc-auth/commit/39fea17))
- **validation:** ✨   Integrated token validation ([8481892](https://github.com/itpropro/nuxt-oidc-auth/commit/8481892))
- **session:** ✨   Implemented expiration check and automatic token refresh ([a039eec](https://github.com/itpropro/nuxt-oidc-auth/commit/a039eec))
- **config:** ✨   Improved typings, added providers, improved claim features ([7d0d9c2](https://github.com/itpropro/nuxt-oidc-auth/commit/7d0d9c2))
- **composables:** ✨   Added login, logout and renamed composable import ([37f38c3](https://github.com/itpropro/nuxt-oidc-auth/commit/37f38c3))
- **playground:** ✨   Updated playground, removed knitwork dep, type improvements ([5ea5845](https://github.com/itpropro/nuxt-oidc-auth/commit/5ea5845))
- **middleware:** ✨   Added optional global auth middleware ([35a6e54](https://github.com/itpropro/nuxt-oidc-auth/commit/35a6e54))

### 🩹 Fixes

- **build:** 💚   Fixed type imports that prevented a successful build ([9201cc3](https://github.com/itpropro/nuxt-oidc-auth/commit/9201cc3))

### 💅 Refactors

- **structure:** ♻️   Improved structure and type references ([5c11215](https://github.com/itpropro/nuxt-oidc-auth/commit/5c11215))
- **types:** 🏷️   Improved typings ([71e7fa2](https://github.com/itpropro/nuxt-oidc-auth/commit/71e7fa2))

### 📖 Documentation

- **readme:** ✏️   Updated README ([34c7bb3](https://github.com/itpropro/nuxt-oidc-auth/commit/34c7bb3))
- **readme:** ✏️   Updated README with secret and session information ([a89f655](https://github.com/itpropro/nuxt-oidc-auth/commit/a89f655))
- **readme:** ✏️   Added hint to not overwrite internal session properties ([c3c9daf](https://github.com/itpropro/nuxt-oidc-auth/commit/c3c9daf))

### ❤️ Contributors

- Jan-Henrik Damaschke ([@itpropro](http://github.com/itpropro))
