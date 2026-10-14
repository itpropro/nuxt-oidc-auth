import type { H3Event } from 'h3'
import { createError } from 'h3'

import { useRuntimeConfig } from '#imports'

import * as providerPresets from '../../providers'
import type { EffectiveProviderConfig, ProviderKeys, ProviderRuntimeConfig } from '../../types'
import { resolveProviderConfig } from './config'

export function useOidcProviderConfig<K extends ProviderKeys>(
  event: H3Event,
  provider: K,
): EffectiveProviderConfig<K> {
  const runtimeProviders = useRuntimeConfig(event).oidc.providers as ProviderRuntimeConfig
  const runtimeProvider = runtimeProviders[provider]

  if (!runtimeProvider) {
    throw createError({
      statusCode: 404,
      statusMessage: `OIDC provider "${provider}" is not configured.`,
    })
  }

  return resolveProviderConfig(
    runtimeProvider,
    providerPresets[provider],
  ) as EffectiveProviderConfig<K>
}
