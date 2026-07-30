import { describe, expect, it } from 'vitest'
import { EVENTS } from '../data/events'
import { deathFarewellLine, ensureDeathPaceQueues, hasDeathPaceFlag } from '../lib/deathPace'
import type { Character } from '../types'

function stubChar(over: Partial<Character> = {}): Character {
  return {
    name: '测试',
    gender: '男',
    age: 45,
    lifespan: 80,
    originId: 'orphan',
    traitIds: [],
    attrs: { 根骨: 50, 悟性: 50, 福缘: 50, 魅力: 50, 体魄: 50, 心性: 0, 机缘: 50 },
    wealth: 10,
    force: 20,
    fameGood: 0,
    fameEvil: 0,
    realm: '先天',
    martialArts: [],
    titles: [],
    flags: [],
    relations: [],
    eventQueue: [],
    yearsWithoutMajor: 0,
    ...over,
  } as Character
}

describe('deathPace', () => {
  it('破境之劫须吃突破债旗', () => {
    const ev = EVENTS.find((e) => e.id === 'death_breakthrough')
    expect(ev?.conditions?.anyFlags).toEqual(
      expect.arrayContaining(['inner_risk', 'broke_through', 'omen_breakthrough_done']),
    )
    expect(ev?.conditions?.forbidFlags).toContain('broke_through_safe')
  })

  it('有债时会排队真气逆乱预警', () => {
    const c = stubChar({ flags: ['broke_through', 'inner_risk'] })
    ensureDeathPaceQueues(c)
    expect(c.eventQueue.some((q) => q.eventId === 'omen_breakthrough')).toBe(true)
  })

  it('无债时不排队破境预警', () => {
    const c = stubChar({ flags: [] })
    ensureDeathPaceQueues(c)
    expect(c.eventQueue.some((q) => q.eventId === 'omen_breakthrough')).toBe(false)
  })

  it('朝廷/毒性/情劫会排队预警', () => {
    const court = stubChar({ flags: ['official'] })
    ensureDeathPaceQueues(court)
    expect(court.eventQueue.some((q) => q.eventId === 'omen_court_wind')).toBe(true)

    const poison = stubChar({ flags: ['poisoned_once'] })
    ensureDeathPaceQueues(poison)
    expect(poison.eventQueue.some((q) => q.eventId === 'omen_poison_tide')).toBe(true)

    const love = stubChar({ age: 36, flags: ['lost_lover'] })
    ensureDeathPaceQueues(love)
    expect(love.eventQueue.some((q) => q.eventId === 'omen_qingjie')).toBe(true)
  })

  it('绝笔文案贴死因', () => {
    const c = stubChar()
    expect(deathFarewellLine(c, '突破失败，元气尽散')).toMatch(/冲关|破境|劫/)
    expect(deathFarewellLine(c, '朝廷赐死')).toMatch(/密旨|朝堂/)
    expect(deathFarewellLine(c, '渡劫失败，形神俱灭')).toMatch(/天象|劫/)
    expect(deathFarewellLine({ ...c, age: 62 }, '一代宗师，无疾而终')).not.toMatch(/那几年/)
  })

  it('铺垫旗可识别', () => {
    expect(hasDeathPaceFlag(stubChar({ flags: ['inner_risk'] }))).toBe(true)
    expect(hasDeathPaceFlag(stubChar({ flags: [] }))).toBe(false)
  })

  it('预警与致死事件已入库', () => {
    for (const id of [
      'omen_breakthrough',
      'omen_court_wind',
      'omen_poison_tide',
      'omen_sect_siege',
      'omen_qingjie',
      'omen_lifespan',
      'death_breakthrough',
    ]) {
      expect(EVENTS.some((e) => e.id === id)).toBe(true)
    }
  })
})
