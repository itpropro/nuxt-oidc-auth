import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('ssr', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/module', import.meta.url)),
    configFile: fileURLToPath(new URL('./fixtures/module/nuxt.config.ts', import.meta.url)),
  })

  it('renders the index page', async () => {
    const html = await $fetch('/')
    expect(html).toContain('<div>Nuxt OIDC Auth</div>')
  })

  it('mounts the configured auth providers', async () => {
    const html = await $fetch('/auth/github/login')
    expect(html).toBeDefined()
  })
})
