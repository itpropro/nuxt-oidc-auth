import { defineOidcProvider } from './provider'
import type { OidcProviderConfig } from '../types'

type GithubRequiredFields = 'clientId' | 'clientSecret' | 'redirectUri'

export const github = defineOidcProvider<OidcProviderConfig, GithubRequiredFields>({
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userinfoUrl: 'https://api.github.com/user',
  tokenRequestType: 'json',
  responseType: 'code',
  authenticationScheme: 'body',
  grantType: 'authorization_code',
  scope: ['user:email'],
  pkce: false,
  state: true,
  nonce: false,
  scopeInTokenRequest: false,
  skipAccessTokenParsing: true,
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  validateAccessToken: false,
  validateIdToken: false,
})
