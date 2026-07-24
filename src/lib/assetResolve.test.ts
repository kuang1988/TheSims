import { describe, expect, it } from 'vitest'
import { createBirth } from '../engine/simulator'
import {
  ALL_CLIMAX_KEYS,
  DEATH_TAG_FINE_KEY,
  PORTRAIT_ARCHETYPES,
} from '../data/assetManifest'
import {
  artUrlForLog,
  climaxKeyFromEventId,
  climaxKeyFromHighlight,
  climaxPath,
  endingDeathPath,
  portraitPath,
  resolvePortraitArchetype,
} from './assetResolve'

describe('assetResolve', () => {
  it('maps all death fine tags to ending paths', () => {
    for (const [tag, key] of Object.entries(DEATH_TAG_FINE_KEY)) {
      expect(endingDeathPath(tag)).toBe(`ending/e_death_${key}.webp`)
    }
  })

  it('keeps birth portraitLook even after joining a sect', () => {
    const base = createBirth(42, '男')
    const look = base.portraitLook
    const huashan = { ...base, flags: [...base.flags, 'sect_huashan'] }
    expect(resolvePortraitArchetype(huashan)).toBe(look)
    expect(portraitPath(huashan)).toBe(portraitPath(base))
  })

  it('assigns random portraitLook at birth; same seed is stable', () => {
    const a = createBirth(101, '男')
    const b = createBirth(202, '男')
    expect(a.portraitLook).toBeTruthy()
    expect(b.portraitLook).toBeTruthy()
    expect(resolvePortraitArchetype(a)).toBe(a.portraitLook)
    expect(createBirth(101, '男').portraitLook).toBe(a.portraitLook)
  })

  it('normalizes invalid gender×look pairs in path', () => {
    const f = { ...createBirth(43, '女'), portraitLook: 'shaolin' as const }
    expect(portraitPath(f)).toBe('portrait/p_f_emei.webp')
    const m = { ...createBirth(44, '男'), portraitLook: 'emei' as const }
    expect(portraitPath(m)).toBe('portrait/p_m_huashan.webp')
  })

  it('covers all portrait archetypes in manifest', () => {
    expect(PORTRAIT_ARCHETYPES.length).toBeGreaterThanOrEqual(9)
  })

  it('maps highlight titles and event ids to climax keys', () => {
    expect(climaxKeyFromHighlight('33岁·华山余剑')).toBe('c_sect_finale')
    expect(climaxKeyFromHighlight('28岁·山门浴血')).toBe('c_sect_war')
    expect(climaxKeyFromEventId('love_finale')).toBe('c_love_finale')
    expect(climaxKeyFromEventId('civic_shi_late')).toBe('c_civic_finale')
    for (const key of ALL_CLIMAX_KEYS) {
      expect(climaxPath(key)).toBe(`climax/${key}.webp`)
    }
  })

  it('resolves art for event and death logs', () => {
    const c = createBirth(42, '男')
    const withSect = { ...c, flags: [...c.flags, 'sect_huashan'] }
    const climax = artUrlForLog(
      {
        age: 30,
        kind: 'event',
        title: '华山余剑',
        text: '……',
        importance: 5,
        eventId: 'huashan_finale',
      },
      withSect,
    )
    expect(climax).toContain('climax/c_sect_finale.webp')

    const death = artUrlForLog(
      {
        age: 70,
        kind: 'death',
        title: '陨落',
        text: '一代宗师，无疾而终',
        importance: 5,
      },
      withSect,
    )
    expect(death).toContain('ending/e_death_zongshi.webp')
  })
})
