import type { getUserSession } from '../../../dist/runtime/server/utils/session.js'
import type {
  EffectiveProviderConfig,
  ProviderRuntimeConfig,
  UserSession,
  UserSessionClaims,
} from '../../../dist/runtime/types.js'

declare module '#oidc-auth' {
  interface UserSessionClaims {
    login_hint?: string
  }
}

type IsAny<T> = 0 extends 1 & T ? true : false
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type ExpectFalse<T extends false> = T
type ExpectTrue<T extends true> = T
type MicrosoftConfigIsTyped = ExpectFalse<IsAny<EffectiveProviderConfig<'microsoft'>>>
type ServerSession = Awaited<ReturnType<typeof getUserSession>>
type AugmentedClaimIsTyped = ExpectTrue<
  Equal<NonNullable<ServerSession['claims']>['login_hint'], string | undefined>
>
type OtherClaimsStayUnknown = ExpectTrue<
  Equal<NonNullable<UserSession['claims']>['tenant'], unknown>
>
type ClaimsStayOptional = ExpectTrue<undefined extends UserSession['claims'] ? true : false>

const runtimeConfig = {
  microsoft: { tenantId: 'common' },
} satisfies ProviderRuntimeConfig

declare const effectiveConfig: EffectiveProviderConfig<'microsoft'>

effectiveConfig.tenantId?.toUpperCase()
runtimeConfig.microsoft.tenantId.toUpperCase()

// @ts-expect-error augmented claims keep their declared type
;({ login_hint: 42 }) satisfies UserSessionClaims

export type {
  AugmentedClaimIsTyped,
  ClaimsStayOptional,
  MicrosoftConfigIsTyped,
  OtherClaimsStayUnknown,
}
