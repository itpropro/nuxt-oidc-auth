import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    onConsoleLog(log: string): void {
      console.log(log)
    },
  },
})
