#!/usr/bin/env sh
set -eu

export NUXT_OIDC_TEST_ENABLE_KEYCLOAK=true

exec pnpm exec playwright test --config playwright.config.ts --project=keycloak --workers=1 "$@"
