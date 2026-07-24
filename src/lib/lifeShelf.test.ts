import { describe, expect, it, beforeEach } from 'vitest'
import { createBirth, buildEnding, LifeSimulator } from '../engine/simulator'
import {
  bookTitleFromEnding,
  isPremiumEnding,
  loadShelf,
  markShelfRead,
  removeShelfBook,
  upsertShelfBook,
} from './lifeShelf'

function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v))
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  })
}

describe('lifeShelf', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('upserts ending onto shelf and marks read', () => {
    const c = createBirth(42, '男')
    const sim = new LifeSimulator(c, 42 ^ 0xabcdef, 'auto')
    sim.runUntilPause(250)
    const ending = buildEnding(sim)
    const list = upsertShelfBook(ending, 42, '农户')
    expect(list.length).toBe(1)
    expect(list[0].title).toBe(bookTitleFromEnding(ending))
    expect(loadShelf().length).toBe(1)

    const read = markShelfRead(list[0].id)
    expect(read[0].readAt).toBeTruthy()

    expect(removeShelfBook(list[0].id).length).toBe(0)
  })

  it('flags premium by score', () => {
    const c = createBirth(1, '女')
    expect(
      isPremiumEnding({
        deathReason: '寿元耗尽，寿终正寝',
        endingTags: ['寿终正寝'],
        summary: '……',
        score: 900,
        finalAge: 70,
        character: c,
        highlights: [],
        mainline: '散修',
        force: 10,
        lifeLog: [],
      }),
    ).toBe(true)
  })
})
