import { describe, expect, it } from 'vitest'
import { EVENTS } from '../data/events'
import { PHASE12_LIFE_EVENTS } from '../data/phase12LifeEvents'
import { createBirth } from '../engine/simulator'
import { buildLifeBookPages, findClimaxPageIndex } from './lifeBookPages'

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

  it('lists all climaxes in toc without hard cap of 8', () => {
    const c = createBirth(12, '女')
    const logs = Array.from({ length: 20 }, (_, i) => ({
      age: 10 + i,
      kind: 'event' as const,
      title: `大事${i}`,
      text: '……',
      importance: 4 as const,
    }))
    const pages = buildLifeBookPages(logs, c)
    const tocPages = pages.filter((p) => p.kind === 'toc')
    const listed = tocPages.flatMap((p) => p.entries)
    expect(listed.length).toBe(20)
    expect(tocPages.length).toBeGreaterThan(1)
    expect(tocPages[0]?.title).toMatch(/目录/)
  })

  it('jumps toc entries with same title to distinct ages', () => {
    const c = createBirth(12, '男')
    const logs = [
      { age: 51, kind: 'event' as const, title: '闭关突破', text: '甲', importance: 4 as const },
      { age: 55, kind: 'event' as const, title: '闭关突破', text: '乙', importance: 4 as const },
    ]
    const pages = buildLifeBookPages(logs, c)
    const i51 = findClimaxPageIndex(pages, logs[0])
    const i55 = findClimaxPageIndex(pages, logs[1])
    expect(i51).toBeGreaterThan(-1)
    expect(i55).toBeGreaterThan(-1)
    expect(i51).not.toBe(i55)
    expect(pages[i51]?.age).toBe(51)
    expect(pages[i55]?.age).toBe(55)
  })

  it('includes death in toc matching climax pages 1:1', () => {
    const c = createBirth(12, '男')
    const logs = [
      { age: 20, kind: 'event' as const, title: '华山余剑', text: '……', importance: 5 as const },
      {
        age: 55,
        kind: 'death' as const,
        title: '陨落',
        text: '寿元耗尽，寿终正寝',
        importance: 5 as const,
      },
    ]
    const pages = buildLifeBookPages(logs, c)
    const tocEntries = pages.filter((p) => p.kind === 'toc').flatMap((p) => p.entries)
    const climaxPages = pages.filter((p) => p.kind === 'climax')
    expect(tocEntries.length).toBe(climaxPages.length)
    expect(tocEntries.some((e) => e.kind === 'death')).toBe(true)
    expect(findClimaxPageIndex(pages, logs[1])).toBeGreaterThan(-1)
  })
})
