import type { Character, EventDef } from '../types'
import { TRAITS } from '../data/traits'

function traitById(id: string) {
  return TRAITS.find((t) => t.id === id)
}

/**
 * 词条 tags → 事件池加权（故事驱动，非新系统）
 */
export const TRAIT_TAG_WEIGHT: Record<
  string,
  { eventTags?: string[]; chains?: string[]; mult: number }
> = {
  厄运: { eventTags: ['灾祸', '坏事'], mult: 1.8 },
  气运: { eventTags: ['好事', '奇遇'], mult: 1.7 },
  情缘: { eventTags: ['情缘'], chains: ['love'], mult: 1.85 },
  剑: { eventTags: ['武学'], chains: ['sect'], mult: 1.35 },
  刀: { eventTags: ['战斗'], chains: ['blade'], mult: 1.9 },
  毒: { eventTags: ['灾祸'], chains: ['poison'], mult: 1.9 },
  商途: { eventTags: ['日常'], chains: ['merchant'], mult: 1.85 },
  朝廷: { eventTags: ['朝廷'], chains: ['court'], mult: 1.85 },
  邪道: { eventTags: ['邪道', '魔教'], chains: ['demon'], mult: 1.7 },
  正道: { eventTags: ['正道', '侠义'], chains: ['justice'], mult: 1.55 },
  侠义: { eventTags: ['正道', '侠义'], chains: ['justice'], mult: 1.5 },
  医术: { eventTags: ['医术'], mult: 1.8 },
  奇遇: { eventTags: ['奇遇'], mult: 1.75 },
  战斗: { eventTags: ['战斗'], mult: 1.45 },
  修炼: { eventTags: ['修炼', '武学'], mult: 1.5 },
  力量: { eventTags: ['奇遇', '战斗'], mult: 1.35 },
  轻功: { eventTags: ['奇遇'], mult: 1.25 },
  外功: { eventTags: ['战斗', '修炼'], mult: 1.35 },
  拳掌: { eventTags: ['修炼', '战斗'], mult: 1.3 },
  悟性: { eventTags: ['修炼', '武学'], mult: 1.45 },
  心性: { eventTags: ['正道', '邪道'], mult: 1.15 },
  寿命: { eventTags: ['灾祸'], mult: 1.2 },
  体弱: { eventTags: ['灾祸'], mult: 1.55 },
  贪婪: { eventTags: ['邪道'], mult: 1.35 },
  交际: { eventTags: ['情缘', '朝廷'], mult: 1.35 },
}

/** 按属性修正事件权重（机缘/悟性/魅力等） */
export function attrWeightFactor(c: Character, e: EventDef): number {
  let f = 1
  const fate = c.attrs.机缘
  const wit = c.attrs.悟性
  const charm = c.attrs.魅力
  const luck = c.attrs.福缘

  if (e.tags.includes('奇遇') || e.importance >= 5) {
    f *= 0.55 + fate / 90
  }
  if (e.tags.includes('灾祸') || e.tags.includes('坏事')) {
    f *= 1.25 - fate / 200
  }

  if (
    e.tags.includes('修炼') ||
    e.tags.includes('武学') ||
    e.id.includes('closedoor') ||
    e.id.includes('heaven')
  ) {
    f *= 0.65 + wit / 95
  }

  if (e.tags.includes('情缘') || e.chain === 'love' || e.tags.includes('朝廷')) {
    f *= 0.65 + charm / 95
  }

  if (e.tags.includes('好事')) f *= 0.85 + luck / 200

  return f
}

export function traitWeightFactor(c: Character, e: EventDef): number {
  let f = 1
  for (const tid of c.traitIds) {
    const def = traitById(tid)
    if (!def?.tags) continue
    for (const tag of def.tags) {
      const rule = TRAIT_TAG_WEIGHT[tag]
      if (!rule) continue
      const tagHit = rule.eventTags?.some((t) => e.tags.includes(t))
      const chainHit = rule.chains?.includes(e.chain ?? '')
      if (tagHit || chainHit) f *= rule.mult
    }
  }
  return Math.min(4.5, Math.max(0.25, f))
}
