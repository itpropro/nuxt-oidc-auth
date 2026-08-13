#!/usr/bin/env sh
set -eu

export NUXT_OIDC_AUTH_SESSION_SECRET=test-auth-session-secret-at-least-48-characters-long
export NUXT_OIDC_DEFAULT_PROVIDER=oidc
export NUXT_OIDC_PROVIDERS_OIDC_AUDIENCE=nuxt-oidc-test
export NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL=http://127.0.0.1:5556/dex/auth/mock
export NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID=nuxt-oidc-test
export NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET=nuxt-oidc-test-secret
export NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI=http://localhost:31840/auth/oidc/callback
export NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL=http://127.0.0.1:5556/dex/token
export NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL=http://127.0.0.1:5556/dex/userinfo
export NUXT_OIDC_SESSION_SECRET=test-user-session-secret-at-least-48-characters-long
export NUXT_OIDC_TOKEN_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
export PORT=31840

echo OFFLINE_NUXT_PRODUCTION_BUILD=1 >&2
pnpm exec nuxt build test/fixtures/oidcApp
exec node test/setup/offline-app.mjs
