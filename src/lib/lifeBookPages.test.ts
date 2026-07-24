import { describe, expect, it } from 'vitest'
import { EVENTS } from '../data/events'
import { PHASE12_LIFE_EVENTS } from '../data/phase12LifeEvents'
import { createBirth } from '../engine/simulator'
import { buildLifeBookPages } from './lifeBookPages'

describe('phase12 content', () => {
  it('adds at least 50 life events and reaches census floor', () => {
    expect(PHASE12_LIFE_EVENTS.length).toBe(50)
    expect(EVENTS.length).toBeGreaterThanOrEqual(359)
    const ids = new Set(EVENTS.map((e) => e.id))
    expect(ids.size).toBe(EVENTS.length)
    for (const e of PHASE12_LIFE_EVENTS) {
      expect(ids.has(e.id)).toBe(true)
    }
  })
})

describe('lifeBookPages', () => {
  it('builds cover, toc, content and back', () => {
    const c = createBirth(12, '男')
    const logs = [
      {
        age: 10,
        kind: 'event' as const,
        title: '村口玩耍',
        text: '……',
        importance: 2,
      },
      {
        age: 20,
        kind: 'event' as const,
        title: '华山余剑',
        text: '……',
        importance: 5,
        eventId: 'huashan_finale',
      },
      {
        age: 55,
        kind: 'death' as const,
        title: '陨落',
        text: '寿元耗尽，寿终正寝',
        importance: 5,
      },
    ]
    const pages = buildLifeBookPages(logs, c, { seed: 12, originName: '农户' })
    expect(pages[0]?.kind).toBe('cover')
    expect(pages.some((p) => p.kind === 'toc')).toBe(true)
    expect(pages.some((p) => p.kind === 'climax')).toBe(true)
    expect(pages[pages.length - 1]?.kind).toBe('back')
  })
})
