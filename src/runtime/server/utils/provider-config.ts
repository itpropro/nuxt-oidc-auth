import type { H3Event } from 'h3'
import { createError } from 'h3'

import { useRuntimeConfig } from '#imports'

import * as providerPresets from '../../providers'
import type { EffectiveProviderConfig, ProviderKeys } from '../../types'
import { resolveProviderConfig, resolveProviderSessionConfig } from './config'

const providerPresetsByName = { ...providerPresets }

export function isOidcProvider(provider: unknown): provider is ProviderKeys {
  return typeof provider === 'string' && Object.hasOwn(providerPresetsByName, provider)
}

export function useOidcProviderConfig<K extends ProviderKeys>(
  event: H3Event,
  provider: K,
): EffectiveProviderConfig<K> {
  const runtimeConfig = useRuntimeConfig(event).oidc
  const runtimeProvider = runtimeConfig.providers[provider]

  if (!runtimeProvider) {
    throw createError({
      statusCode: 404,
      statusMessage: `OIDC provider "${provider}" is not configured.`,
    })
  }

  const config = resolveProviderConfig(runtimeProvider, providerPresetsByName[provider])
  return {
    ...config,
    sessionConfiguration: resolveProviderSessionConfig(
      runtimeProvider,
      config.sessionConfiguration,
      runtimeConfig.session,
    ),
  }
}
