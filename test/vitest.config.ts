import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    onConsoleLog(log: string): void {
      // eslint-disable-next-line no-console
      console.log(log)
    },
  },
})
