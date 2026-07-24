import { describe, expect, it } from 'vitest'
import { dragFlipIntent, edgeFlipIntent, shouldUseDualSpread } from './bookFlip'

describe('bookFlip', () => {
  it('dragFlipIntent respects threshold', () => {
    expect(dragFlipIntent(-20)).toBeNull()
    expect(dragFlipIntent(-60)).toBe('next')
    expect(dragFlipIntent(60)).toBe('prev')
  })

  it('edgeFlipIntent hits side zones', () => {
    expect(edgeFlipIntent(10, 0, 1000)).toBe('prev')
    expect(edgeFlipIntent(990, 0, 1000)).toBe('next')
    expect(edgeFlipIntent(500, 0, 1000)).toBeNull()
  })

  it('dual spread breakpoint', () => {
    expect(shouldUseDualSpread(899)).toBe(false)
    expect(shouldUseDualSpread(900)).toBe(true)
  })
})
