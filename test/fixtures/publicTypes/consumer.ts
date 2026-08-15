import type { EffectiveProviderConfig, ProviderRuntimeConfig } from '../../../dist/runtime/types.js'

type IsAny<T> = 0 extends 1 & T ? true : false
type ExpectFalse<T extends false> = T
type MicrosoftConfigIsTyped = ExpectFalse<IsAny<EffectiveProviderConfig<'microsoft'>>>

const runtimeConfig = {
  microsoft: { tenantId: 'common' },
} satisfies ProviderRuntimeConfig

declare const effectiveConfig: EffectiveProviderConfig<'microsoft'>

effectiveConfig.tenantId?.toUpperCase()
runtimeConfig.microsoft.tenantId.toUpperCase()

export type { MicrosoftConfigIsTyped }
