import { describe, expect, it } from 'vitest'
import { isProductionEnvironment } from '../../../src/runtime/utils/environment'

describe('isProductionEnvironment', () => {
  it.each([
    ['production', true],
    ['Production', true],
    ['prod', true],
    ['PROD-preview', true],
    ['development', false],
    ['', false],
    [undefined, false],
  ])('classifies %s as production=%s', (environment, expected) => {
    expect(isProductionEnvironment(environment)).toBe(expected)
  })
})
