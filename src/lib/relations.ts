import type { Character, RelationKind, RelationSlot } from '../types'

const NPC_POOL = [
  '陈玄机', '苏晚晴', '霍破军', '白无尘', '沈听雪',
  '顾长风', '裴青萝', '岳问天', '柳如烟', '段铁心',
  '慕容远', '谢寒江', '陆清歌', '萧承安', '方念慈',
  '叶知秋', '韩立风', '程霜月', '赵无忌', '温如玉',
  '唐青枫', '姬瑶光', '司马烈', '南宫雪', '独孤行',
]

export function randomNpcName(rng: () => number, _kind: RelationKind): string {
  return NPC_POOL[Math.floor(rng() * NPC_POOL.length)]
}

export function upsertRelation(
  c: Character,
  patch: {
    kind: RelationKind
    name?: string
    bond?: number
    revengeIn?: number | null
    note?: string
    clear?: boolean
  },
  rng: () => number,
): string | null {
  if (patch.clear) {
    const before = c.relations.find((r) => r.kind === patch.kind)
    c.relations = c.relations.filter((r) => r.kind !== patch.kind)
    return before ? `与${before.name}（${patch.kind}）关系断绝。` : null
  }

  const existing = c.relations.find((r) => r.kind === patch.kind)
  const name = patch.name ?? existing?.name ?? randomNpcName(rng, patch.kind)
  const bond = patch.bond ?? existing?.bond ?? (patch.kind === '仇敌' ? -40 : 40)
  const revengeIn =
    patch.revengeIn !== undefined
      ? patch.revengeIn
      : patch.kind === '仇敌'
        ? (existing?.revengeIn ?? 3)
        : null

  const slot: RelationSlot = {
    kind: patch.kind,
    name,
    bond,
    revengeIn: patch.kind === '仇敌' ? revengeIn : null,
    note: patch.note ?? existing?.note,
  }

  if (existing) {
    Object.assign(existing, slot)
    if (patch.kind === '仇敌' && slot.revengeIn != null) {
      return `与仇敌「${slot.name}」的清算倒计时：${slot.revengeIn}年。`
    }
    return `与${slot.kind}「${slot.name}」关系更新（羁绊 ${slot.bond}）。`
  }

  if (c.relations.length >= 5) {
    const weak = [...c.relations]
      .filter((r) => r.kind !== '仇敌')
      .sort((a, b) => a.bond - b.bond)[0]
    if (weak) c.relations = c.relations.filter((r) => r !== weak)
  }
  c.relations.push(slot)
  if (slot.kind === '仇敌' && slot.revengeIn != null) {
    return `结仇「${slot.name}」，约 ${slot.revengeIn} 年后寻仇。`
  }
  return `结识${slot.kind}「${slot.name}」。`
}

/** 每年推进仇敌倒计时，到期返回需排队的事件 id */
export function tickEnemyCountdowns(c: Character): string[] {
  const due: string[] = []
  for (const r of c.relations) {
    if (r.kind !== '仇敌' || r.revengeIn == null) continue
    if (r.revengeIn <= 0) continue
    r.revengeIn -= 1
    if (r.revengeIn <= 0) {
      due.push('relation_revenge')
      if (!c.flags.includes('enemy_due')) c.flags.push('enemy_due')
      r.note = r.name
    }
  }
  return due
}
