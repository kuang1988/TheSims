import { describe, expect, it } from 'vitest'
import { cleanPlayerNameInput, guardPlayerName } from './nameGuard'

describe('nameGuard', () => {
  it('keeps normal wuxia names', () => {
    expect(guardPlayerName('张孤鸿')).toEqual({ ok: true, name: '张孤鸿' })
    expect(guardPlayerName('李·清婉')).toEqual({ ok: true, name: '李·清婉' })
  })

  it('strips latin digits and invisible chars while typing', () => {
    expect(cleanPlayerNameInput('张a1孤\u200b鸿')).toBe('张孤鸿')
    expect(cleanPlayerNameInput('  王  五  ')).toBe('王五')
  })

  it('rejects empty short or blocked names', () => {
    expect(guardPlayerName('').ok).toBe(false)
    expect(guardPlayerName('甲').ok).toBe(false)
    expect(guardPlayerName('习近平').ok).toBe(false)
    expect(guardPlayerName('傻 逼').ok).toBe(false)
    expect(guardPlayerName('管理员').ok).toBe(false)
    const bad = guardPlayerName('傻逼')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.name).toBe('无名侠客')
  })

  it('rejects repeated glyph spam', () => {
    expect(guardPlayerName('啊啊啊').ok).toBe(false)
  })
})
