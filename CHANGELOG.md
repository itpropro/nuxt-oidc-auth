# Changelog


## v0.11.3

[compare changes](https://github.com/itpropro/nuxt-oidc-auth/compare/v0.11.2...v0.11.3)

## v0.11.2


### 🚀 Enhancements

- Allow users to define custom session factory + types ([#2](https://github.com/itpropro/nuxt-oidc-auth/pull/2))
- Added google as oauth provider ([#3](https://github.com/itpropro/nuxt-oidc-auth/pull/3))
- Added twitch as supported oauth provider ([#5](https://github.com/itpropro/nuxt-oidc-auth/pull/5))
- Added auth0 as oauth provider ([#6](https://github.com/itpropro/nuxt-oidc-auth/pull/6))
- Added discord auth provider ([#7](https://github.com/itpropro/nuxt-oidc-auth/pull/7))
- Added oauth battle.net ([#11](https://github.com/itpropro/nuxt-oidc-auth/pull/11))
- Refactor login buttons to use dropdown ([#14](https://github.com/itpropro/nuxt-oidc-auth/pull/14))
- Add max_age param for auth0 ([#26](https://github.com/itpropro/nuxt-oidc-auth/pull/26))
- Added Microsoft as oauth provider ([#8](https://github.com/itpropro/nuxt-oidc-auth/pull/8))
- Added linkedIn auth provider ([#13](https://github.com/itpropro/nuxt-oidc-auth/pull/13))
- Add sessionHooks to extend user sessions ([c470319](https://github.com/itpropro/nuxt-oidc-auth/commit/c470319))
- **Initial fork commit:** ✨   Changed structure, added generic OIDC logic ([6b924f7](https://github.com/itpropro/nuxt-oidc-auth/commit/6b924f7))
- **jwt:** ✨   Added optional token validation ([39fea17](https://github.com/itpropro/nuxt-oidc-auth/commit/39fea17))
- **validation:** ✨   Integrated token validation ([8481892](https://github.com/itpropro/nuxt-oidc-auth/commit/8481892))
- **session:** ✨   Implemented expiration check and automatic token refresh ([a039eec](https://github.com/itpropro/nuxt-oidc-auth/commit/a039eec))
- **config:** ✨   Improved typings, added providers, improved claim features ([7d0d9c2](https://github.com/itpropro/nuxt-oidc-auth/commit/7d0d9c2))
- **composables:** ✨   Added login, logout and renamed composable import ([37f38c3](https://github.com/itpropro/nuxt-oidc-auth/commit/37f38c3))
- **playground:** ✨   Updated playground, removed knitwork dep, type improvements ([5ea5845](https://github.com/itpropro/nuxt-oidc-auth/commit/5ea5845))
- **middleware:** ✨   Added optional global auth middleware ([35a6e54](https://github.com/itpropro/nuxt-oidc-auth/commit/35a6e54))
- **composables:** 🔥   Deprecated configuredProviders property ([9acfea5](https://github.com/itpropro/nuxt-oidc-auth/commit/9acfea5))
- **types:** 🏷️   Improved typings for config and composables ([2c64e57](https://github.com/itpropro/nuxt-oidc-auth/commit/2c64e57))
- **oidc:** ✨   Added optional `prompt` parameter to auth request ([a77687b](https://github.com/itpropro/nuxt-oidc-auth/commit/a77687b))
- **session:** ✨   Added persistent session storage cleanup; Improved log outputs ([f171583](https://github.com/itpropro/nuxt-oidc-auth/commit/f171583))
- **provider:** ✨   Added Keycloak provider; Session improvements ([ffa2d92](https://github.com/itpropro/nuxt-oidc-auth/commit/ffa2d92))
- **config:** ✨   Added encodeRedirectUri parameter ([3d0a417](https://github.com/itpropro/nuxt-oidc-auth/commit/3d0a417))
- **session:** ✨   Added exposeAccessToken setting; Exposed expireAt property ([4162eda](https://github.com/itpropro/nuxt-oidc-auth/commit/4162eda))
- **oidc:** ✨   Improved callback error handling ([cc9c012](https://github.com/itpropro/nuxt-oidc-auth/commit/cc9c012))
- **provider:** ✨   Added resource and audience to Entra provider ([ba0f07a](https://github.com/itpropro/nuxt-oidc-auth/commit/ba0f07a))
- **config:** 🔧   Added more secure default for session cookie config ([7fe41ab](https://github.com/itpropro/nuxt-oidc-auth/commit/7fe41ab))
- **provider:** ✨   Added Entra prompt parameter to config ([07a5cf6](https://github.com/itpropro/nuxt-oidc-auth/commit/07a5cf6))
- **session:** ✨   Added expirationThreshold setting ([9933b8e](https://github.com/itpropro/nuxt-oidc-auth/commit/9933b8e))
- **session:** ✨   Added new exposeIdToken setting ([29ffced](https://github.com/itpropro/nuxt-oidc-auth/commit/29ffced))
- **dev-mode:** ✨   Implemented dev mode for local development ([74cadf8](https://github.com/itpropro/nuxt-oidc-auth/commit/74cadf8))
- **devmode:** ✨   Added dynamic generation of (a)symmetric JWT signing keys ([23b9253](https://github.com/itpropro/nuxt-oidc-auth/commit/23b9253))
- **devtools:** ✨   Added Nuxt devtools integration ([d7a3098](https://github.com/itpropro/nuxt-oidc-auth/commit/d7a3098))
- **expiration-check:** ✨   Made expirationCheck apply even if there is no refresh_token ([332dc17](https://github.com/itpropro/nuxt-oidc-auth/commit/332dc17))
- **composables:** ✨   Added clear composable ([2fb6cc9](https://github.com/itpropro/nuxt-oidc-auth/commit/2fb6cc9))

### 🩹 Fixes

- Workaround for addServerImportsDir not working ([5a189df](https://github.com/itpropro/nuxt-oidc-auth/commit/5a189df))
- Don't log warning about password when preparing types ([804057b](https://github.com/itpropro/nuxt-oidc-auth/commit/804057b))
- Import useRuntimeConfig ([bdbb4b8](https://github.com/itpropro/nuxt-oidc-auth/commit/bdbb4b8))
- Use import presets ([f16ebc9](https://github.com/itpropro/nuxt-oidc-auth/commit/f16ebc9))
- **oauth:** Add generic OAuthConfig type ([#18](https://github.com/itpropro/nuxt-oidc-auth/pull/18))
- Avoid infinite loop with latest Nuxt ([93b949d](https://github.com/itpropro/nuxt-oidc-auth/commit/93b949d))
- Add audience to auth0 runtime config types ([#27](https://github.com/itpropro/nuxt-oidc-auth/pull/27))
- Correct arguments for hooks ([6e0193e](https://github.com/itpropro/nuxt-oidc-auth/commit/6e0193e))
- **build:** 💚   Fixed type imports that prevented a successful build ([9201cc3](https://github.com/itpropro/nuxt-oidc-auth/commit/9201cc3))
- **imports:** 🐛   Fixed import bugs ([11b3d28](https://github.com/itpropro/nuxt-oidc-auth/commit/11b3d28))
- **resolve:** 🐛   Fixed wrong middleware resolver reference ([8a275c2](https://github.com/itpropro/nuxt-oidc-auth/commit/8a275c2))
- **handler:** 🐛   Fixed handler imports ([78b989d](https://github.com/itpropro/nuxt-oidc-auth/commit/78b989d))
- **imports:** ♻️   Added additional explicit h3 imports ([5a2edc1](https://github.com/itpropro/nuxt-oidc-auth/commit/5a2edc1))
- **imports:** 🐛   Added missing h3 import for logout handler ([d32260d](https://github.com/itpropro/nuxt-oidc-auth/commit/d32260d))
- **session:** 🐛   Added missing h3 import ([04c1361](https://github.com/itpropro/nuxt-oidc-auth/commit/04c1361))
- **imports:** ♻️   Added missing useRuntimeConfig import for token refresh ([90c2524](https://github.com/itpropro/nuxt-oidc-auth/commit/90c2524))
- **hooks:** 🐛   Removed duplicate refresh hook call ([0bfa7a3](https://github.com/itpropro/nuxt-oidc-auth/commit/0bfa7a3))
- **imports:** 🐛   Added missing import useRuntimeConfig import ([4b59bdd](https://github.com/itpropro/nuxt-oidc-auth/commit/4b59bdd))
- **imports:** 🐛   Implemented fix for unresolved runtimeConfig ([dc48114](https://github.com/itpropro/nuxt-oidc-auth/commit/dc48114))
- **nitro:** 🐛   Added missing defineNitroPlugin nitro import ([8c3002a](https://github.com/itpropro/nuxt-oidc-auth/commit/8c3002a))
- **devtools:** 🐛   Handled null state for auth session ([2d5617b](https://github.com/itpropro/nuxt-oidc-auth/commit/2d5617b))
- **devtools:** 🐛   Handled undefined state for devMode ([8ab934d](https://github.com/itpropro/nuxt-oidc-auth/commit/8ab934d))

### 💅 Refactors

- Use `useSession` generic rather than assertion ([#4](https://github.com/itpropro/nuxt-oidc-auth/pull/4))
- **structure:** ♻️   Improved structure and type references ([5c11215](https://github.com/itpropro/nuxt-oidc-auth/commit/5c11215))
- **types:** 🏷️   Improved typings ([71e7fa2](https://github.com/itpropro/nuxt-oidc-auth/commit/71e7fa2))
- **imports:** ♻️   Added explicit h3 import ([0779de0](https://github.com/itpropro/nuxt-oidc-auth/commit/0779de0))
- **imports:** ♻️   Added explicit h3 imports ([ba112fb](https://github.com/itpropro/nuxt-oidc-auth/commit/ba112fb))
- **imports:** ♻️   Added explicit utils h3 import ([586116b](https://github.com/itpropro/nuxt-oidc-auth/commit/586116b))
- **logging:** ♻️   Improved logging ([171b63c](https://github.com/itpropro/nuxt-oidc-auth/commit/171b63c))
- **logging:** ♻️   Removed unneeded log ([7d221fa](https://github.com/itpropro/nuxt-oidc-auth/commit/7d221fa))
- **secret-defaults:** ♻️   Refactored logic to provide default secrets ([45dd1da](https://github.com/itpropro/nuxt-oidc-auth/commit/45dd1da))

### 📖 Documentation

- Update readme ([06f1504](https://github.com/itpropro/nuxt-oidc-auth/commit/06f1504))
- Add demo ([cbc8b7a](https://github.com/itpropro/nuxt-oidc-auth/commit/cbc8b7a))
- Use consistent reference to module ([13daa78](https://github.com/itpropro/nuxt-oidc-auth/commit/13daa78))
- Add LinkedIn in providers ([c9b9925](https://github.com/itpropro/nuxt-oidc-auth/commit/c9b9925))
- **readme:** ✏️   Updated README ([34c7bb3](https://github.com/itpropro/nuxt-oidc-auth/commit/34c7bb3))
- **readme:** ✏️   Updated README with secret and session information ([a89f655](https://github.com/itpropro/nuxt-oidc-auth/commit/a89f655))
- **readme:** ✏️   Added hint to not overwrite internal session properties ([c3c9daf](https://github.com/itpropro/nuxt-oidc-auth/commit/c3c9daf))
- **readme:** ✏️   Updated npm and playgrounds references ([af72204](https://github.com/itpropro/nuxt-oidc-auth/commit/af72204))
- **readme:** ✏️   Updated badges ([582bcf7](https://github.com/itpropro/nuxt-oidc-auth/commit/582bcf7))
- **readme:** Updated readme ([d6fb470](https://github.com/itpropro/nuxt-oidc-auth/commit/d6fb470))
- **readme:** ✏️   Fixed broken oidc provider link ([46499d9](https://github.com/itpropro/nuxt-oidc-auth/commit/46499d9))
- **readme:** ✏️   Added an example for secrets and key generation ([1a26d0c](https://github.com/itpropro/nuxt-oidc-auth/commit/1a26d0c))
- Use new `nuxi module add` command in installation ([4a910f4](https://github.com/itpropro/nuxt-oidc-auth/commit/4a910f4))
- Added banner ([23795ad](https://github.com/itpropro/nuxt-oidc-auth/commit/23795ad))
- **readme:** ✏️   Restructured docs ([71dad39](https://github.com/itpropro/nuxt-oidc-auth/commit/71dad39))
- **readme:** ✏️   Updated linebreaks ([7dc8bc6](https://github.com/itpropro/nuxt-oidc-auth/commit/7dc8bc6))

### 🏡 Chore

- Init ([19caed2](https://github.com/itpropro/nuxt-oidc-auth/commit/19caed2))
- Add runtime config ([9013484](https://github.com/itpropro/nuxt-oidc-auth/commit/9013484))
- V0 ([18ea43a](https://github.com/itpropro/nuxt-oidc-auth/commit/18ea43a))
- Init ([9b75953](https://github.com/itpropro/nuxt-oidc-auth/commit/9b75953))
- **release:** V0.0.1 ([fd5a2c1](https://github.com/itpropro/nuxt-oidc-auth/commit/fd5a2c1))
- **release:** V0.0.2 ([f01b412](https://github.com/itpropro/nuxt-oidc-auth/commit/f01b412))
- Remove `.nuxtrc` ([3f96e97](https://github.com/itpropro/nuxt-oidc-auth/commit/3f96e97))
- Add type testing script ([e9ffa5e](https://github.com/itpropro/nuxt-oidc-auth/commit/e9ffa5e))
- Move playground into workspace ([bd8108c](https://github.com/itpropro/nuxt-oidc-auth/commit/bd8108c))
- Add playground type test ([74f452c](https://github.com/itpropro/nuxt-oidc-auth/commit/74f452c))
- **release:** V0.0.3 ([9d1342c](https://github.com/itpropro/nuxt-oidc-auth/commit/9d1342c))
- Add comment ([1923dcc](https://github.com/itpropro/nuxt-oidc-auth/commit/1923dcc))
- **release:** V0.0.4 ([2bc6f9a](https://github.com/itpropro/nuxt-oidc-auth/commit/2bc6f9a))
- **release:** V0.0.5 ([86226ad](https://github.com/itpropro/nuxt-oidc-auth/commit/86226ad))
- Update deps ([05f4a9c](https://github.com/itpropro/nuxt-oidc-auth/commit/05f4a9c))
- **release:** V0.0.6 ([4eb4f25](https://github.com/itpropro/nuxt-oidc-auth/commit/4eb4f25))
- Add SameSite=lax ([1b296e2](https://github.com/itpropro/nuxt-oidc-auth/commit/1b296e2))
- **release:** V0.0.7 ([5316d10](https://github.com/itpropro/nuxt-oidc-auth/commit/5316d10))
- **playground:** Better with right title ([97a3ad3](https://github.com/itpropro/nuxt-oidc-auth/commit/97a3ad3))
- **release:** V0.0.8 ([79f7ce7](https://github.com/itpropro/nuxt-oidc-auth/commit/79f7ce7))
- **release:** V0.0.9 ([36cadda](https://github.com/itpropro/nuxt-oidc-auth/commit/36cadda))
- Update deps ([bb3a510](https://github.com/itpropro/nuxt-oidc-auth/commit/bb3a510))
- **release:** V0.0.10 ([c60fde7](https://github.com/itpropro/nuxt-oidc-auth/commit/c60fde7))
- **release:** V0.0.11 ([b52ed08](https://github.com/itpropro/nuxt-oidc-auth/commit/b52ed08))
- **release:** V0.0.12 ([a74e7f4](https://github.com/itpropro/nuxt-oidc-auth/commit/a74e7f4))
- Rename session from verify to fetch ([10694e9](https://github.com/itpropro/nuxt-oidc-auth/commit/10694e9))
- **release:** V0.0.13 ([e344c98](https://github.com/itpropro/nuxt-oidc-auth/commit/e344c98))
- **release:** V0.2.0 ([96280e2](https://github.com/itpropro/nuxt-oidc-auth/commit/96280e2))
- **package:** 📦️   Updated package json ([85f5428](https://github.com/itpropro/nuxt-oidc-auth/commit/85f5428))
- **release:** V0.3.0 ([44dfb34](https://github.com/itpropro/nuxt-oidc-auth/commit/44dfb34))
- **release:** V0.4.0 ([4a27b02](https://github.com/itpropro/nuxt-oidc-auth/commit/4a27b02))
- **release:** V0.5.0 ([ae51113](https://github.com/itpropro/nuxt-oidc-auth/commit/ae51113))
- **release:** V0.6.0 ([6442960](https://github.com/itpropro/nuxt-oidc-auth/commit/6442960))
- **release:** V0.7.0 ([6cac8d9](https://github.com/itpropro/nuxt-oidc-auth/commit/6cac8d9))
- **release:** V0.7.1 ([dae36e7](https://github.com/itpropro/nuxt-oidc-auth/commit/dae36e7))
- **release:** V0.7.2 ([26cd56c](https://github.com/itpropro/nuxt-oidc-auth/commit/26cd56c))
- **release:** V0.7.3 ([789ea71](https://github.com/itpropro/nuxt-oidc-auth/commit/789ea71))
- **release:** V0.7.4 ([ab2cbdb](https://github.com/itpropro/nuxt-oidc-auth/commit/ab2cbdb))
- **release:** V0.7.5 ([0b0b5c6](https://github.com/itpropro/nuxt-oidc-auth/commit/0b0b5c6))
- **release:** V0.7.6 ([7e8743c](https://github.com/itpropro/nuxt-oidc-auth/commit/7e8743c))
- **release:** V0.7.7 ([815a5a8](https://github.com/itpropro/nuxt-oidc-auth/commit/815a5a8))
- **name:** 🚚   Removed package scope ([0b0875a](https://github.com/itpropro/nuxt-oidc-auth/commit/0b0875a))
- **release:** V0.7.8 ([9eb5c7e](https://github.com/itpropro/nuxt-oidc-auth/commit/9eb5c7e))
- **release:** V0.7.9 ([a6ce967](https://github.com/itpropro/nuxt-oidc-auth/commit/a6ce967))
- **release:** V0.8.0 ([463d60e](https://github.com/itpropro/nuxt-oidc-auth/commit/463d60e))
- **release:** V0.9.0 ([5a7a125](https://github.com/itpropro/nuxt-oidc-auth/commit/5a7a125))
- **release:** V0.9.1 ([4f166f5](https://github.com/itpropro/nuxt-oidc-auth/commit/4f166f5))
- **release:** V0.9.2 ([276c447](https://github.com/itpropro/nuxt-oidc-auth/commit/276c447))
- **release:** V0.9.3 ([ca2485d](https://github.com/itpropro/nuxt-oidc-auth/commit/ca2485d))
- **release:** V0.9.4 ([f190e43](https://github.com/itpropro/nuxt-oidc-auth/commit/f190e43))
- **release:** V0.9.5 ([c109915](https://github.com/itpropro/nuxt-oidc-auth/commit/c109915))
- **release:** V0.9.6 ([b08a6a8](https://github.com/itpropro/nuxt-oidc-auth/commit/b08a6a8))
- **release:** V0.9.7 ([6df17c4](https://github.com/itpropro/nuxt-oidc-auth/commit/6df17c4))
- **build:** 💚   Updated build config ([b5bd501](https://github.com/itpropro/nuxt-oidc-auth/commit/b5bd501))
- **release:** V0.9.8 ([b7346b1](https://github.com/itpropro/nuxt-oidc-auth/commit/b7346b1))
- **release:** V0.9.9 ([19bd988](https://github.com/itpropro/nuxt-oidc-auth/commit/19bd988))
- **release:** V0.9.10 ([28f3037](https://github.com/itpropro/nuxt-oidc-auth/commit/28f3037))
- **release:** V0.9.10 ([f1cbbcd](https://github.com/itpropro/nuxt-oidc-auth/commit/f1cbbcd))
- **package:** 📦️   Removed unneeded configs from package.json ([ba4dd1e](https://github.com/itpropro/nuxt-oidc-auth/commit/ba4dd1e))
- **release:** V0.9.11 ([c6b47be](https://github.com/itpropro/nuxt-oidc-auth/commit/c6b47be))
- **release:** V0.10.0 ([0108c97](https://github.com/itpropro/nuxt-oidc-auth/commit/0108c97))
- **release:** V0.10.1 ([8a91b6e](https://github.com/itpropro/nuxt-oidc-auth/commit/8a91b6e))
- **ci:** 💚   Added implicit build command to module builder ([d962d42](https://github.com/itpropro/nuxt-oidc-auth/commit/d962d42))
- **release:** V0.11.0 ([1fec040](https://github.com/itpropro/nuxt-oidc-auth/commit/1fec040))
- **release:** V0.11.1 ([edcd494](https://github.com/itpropro/nuxt-oidc-auth/commit/edcd494))

### ✅ Tests

- **test:** ✅   Setting up tests ([8a3c54a](https://github.com/itpropro/nuxt-oidc-auth/commit/8a3c54a))

### 🤖 CI

- Run lint + test actions in ci ([f50c1b5](https://github.com/itpropro/nuxt-oidc-auth/commit/f50c1b5))
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
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Itpropro ([@itpropro](http://github.com/itpropro))
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- José Manuel Madriaza Caravia ([@LeoMo-27](http://github.com/LeoMo-27))
- H+ ([@justserdar](http://github.com/justserdar))
- Jakub Frelik <j.frelik.it@outlook.com>
- Uģis <berzinsu@gmail.com>
- Sigve Hansen ([@sifferhans](http://github.com/sifferhans))
- Arash ([@arashsheyda](http://github.com/arashsheyda))
- Samuel LEFEVRE ([@samulefevre](http://github.com/samulefevre))
- Antoine Lassier <toinousp@gmail.com>
- Gerben Mulder <gerbenmulder2508@gmail.com>
- Ahmed Rangel ([@ahmedrangel](http://github.com/ahmedrangel))
- Akshara Hegde ([@aksharahegde](http://github.com/aksharahegde))

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
