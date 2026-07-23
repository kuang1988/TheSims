import type { HeartTier, LifeStage, Realm } from '../types'

export const REALMS: Realm[] = ['未入门', '练体', '后天', '先天', '宗师', '大宗师']

export const HEART_TIERS: { tier: HeartTier; min: number; max: number }[] = [
  { tier: '极恶', min: -100, max: -61 },
  { tier: '偏邪', min: -60, max: -21 },
  { tier: '中庸', min: -20, max: 20 },
  { tier: '偏正', min: 21, max: 60 },
  { tier: '至善', min: 61, max: 100 },
]

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function heartTier(value: number): HeartTier {
  const v = clamp(value, -100, 100)
  if (v >= 61) return '至善'
  if (v >= 21) return '偏正'
  if (v >= -20) return '中庸'
  if (v >= -60) return '偏邪'
  return '极恶'
}

export function lifeStage(age: number): LifeStage {
  if (age <= 7) return '幼年'
  if (age <= 15) return '少年'
  if (age <= 30) return '青年'
  if (age <= 50) return '壮年'
  return '晚年'
}

export function realmIndex(realm: Realm): number {
  return REALMS.indexOf(realm)
}

export function eventsPerYear(stage: LifeStage, rng: () => number): number {
  const roll = rng()
  switch (stage) {
    case '幼年':
      return roll < 0.45 ? 1 : 0
    case '少年':
      return roll < 0.35 ? 2 : 1
    case '青年':
      return roll < 0.25 ? 3 : roll < 0.65 ? 2 : 1
    case '壮年':
      return roll < 0.4 ? 2 : 1
    case '晚年':
      return roll < 0.35 ? 2 : roll < 0.75 ? 1 : 0
    default:
      return 1
  }
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function pickWeighted<T>(
  items: T[],
  weightOf: (item: T) => number,
  rng: () => number,
): T | null {
  if (items.length === 0) return null
  const weights = items.map(weightOf)
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return items[Math.floor(rng() * items.length)] ?? null
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return items[i]
  }
  return items[items.length - 1] ?? null
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const SURNAMES = [
  '李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
]

export const MALE_NAMES = [
  '云飞', '无忌', '靖', '襄', '寒', '远', '破军', '清风', '孤鸿', '问天',
  '慕白', '承安', '景行', '怀远', '子轩', '浩然', '凌风', '玄机', '铁心', '思齐',
]

export const FEMALE_NAMES = [
  '若雪', '灵儿', '清婉', '紫烟', '书瑶', '念安', '听雨', '如烟', '青萝', '晚晴',
  '婉儿', '秋水', '月华', '素心', '语嫣', '梦璃', '寒香', '飞燕', '红绫', '碧落',
]

export function randomName(rng: () => number, gender: '男' | '女'): string {
  const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)]
  const pool = gender === '男' ? MALE_NAMES : FEMALE_NAMES
  return surname + pool[Math.floor(rng() * pool.length)]
}
