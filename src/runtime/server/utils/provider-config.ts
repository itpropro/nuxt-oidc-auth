import type { H3Event } from 'h3'
import type { EffectiveProviderConfig, ProviderKeys, ProviderRuntimeConfig } from '../../types'
import { useRuntimeConfig } from '#imports'
import { createError } from 'h3'
import * as providerPresets from '../../providers'
import { resolveEffectiveProviderConfig } from './config'

export async function useOidcProviderConfig<K extends ProviderKeys>(
  event: H3Event,
  provider: K,
): Promise<EffectiveProviderConfig<K>> {
  const runtimeProviders = useRuntimeConfig(event).oidc.providers as ProviderRuntimeConfig
  const runtimeProvider = runtimeProviders[provider]

  if (!runtimeProvider) {
    throw createError({
      statusCode: 404,
      statusMessage: `OIDC provider "${provider}" is not configured.`,
    })
  }

  return (await resolveEffectiveProviderConfig(
    runtimeProvider,
    providerPresets[provider],
  )) as EffectiveProviderConfig<K>
}
