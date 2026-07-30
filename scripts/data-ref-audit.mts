/**
 * 数据引用审计：称号 / 武学发放与表项一致性；队列目标、特质条件、缺余波与重名。
 * 运行：npm run data-audit
 */
import { writeFileSync } from 'fs'
import { EVENTS } from '../src/data/events.ts'
import { TITLES } from '../src/data/titles.ts'
import { MARTIAL_ARTS } from '../src/data/martialArts.ts'
import { TRAITS } from '../src/data/traits.ts'
import type { EffectBundle } from '../src/types.ts'

const titleIds = new Set(TITLES.map((t) => t.id))
const martialIds = new Set(MARTIAL_ARTS.map((m) => m.id))
const traitIds = new Set(TRAITS.map((t) => t.id))
const eventIds = new Set(EVENTS.map((e) => e.id))

const grantedTitles = new Map<string, number>()
const addedMartial = new Map<string, number>()
const orphanTitles: { id: string; eventId: string; field: string }[] = []
const orphanMartial: { id: string; eventId: string }[] = []
const orphanQueue: { id: string; eventId: string; field: string }[] = []
const orphanTraits: { id: string; eventId: string }[] = []

function bump(map: Map<string, number>, id: string) {
  map.set(id, (map.get(id) ?? 0) + 1)
}

function walkEffects(fx: EffectBundle | undefined, eventId: string) {
  if (!fx) return

  if (fx.grantTitle) {
    bump(grantedTitles, fx.grantTitle)
    if (!titleIds.has(fx.grantTitle)) {
      orphanTitles.push({ id: fx.grantTitle, eventId, field: 'grantTitle' })
    }
  }
  if (fx.setPrimaryTitle) {
    // 仅校验引用合法性；不计入「发放」
    if (!titleIds.has(fx.setPrimaryTitle)) {
      orphanTitles.push({ id: fx.setPrimaryTitle, eventId, field: 'setPrimaryTitle' })
    }
  }
  if (fx.addMartialArt) {
    bump(addedMartial, fx.addMartialArt)
    if (!martialIds.has(fx.addMartialArt)) {
      orphanMartial.push({ id: fx.addMartialArt, eventId })
    }
  }
  // upgradeMartialArt === 'any' 为白名单，不计入武学 id 校验

  if (fx.queueEvent) {
    if (!eventIds.has(fx.queueEvent.id)) {
      orphanQueue.push({ id: fx.queueEvent.id, eventId, field: 'queueEvent' })
    }
  }
  if (fx.queueEvents) {
    for (const q of fx.queueEvents) {
      if (!eventIds.has(q.id)) {
        orphanQueue.push({ id: q.id, eventId, field: 'queueEvents' })
      }
    }
  }

  if (fx.combat) {
    walkEffects(fx.combat.onWin, eventId)
    walkEffects(fx.combat.onLose, eventId)
    walkEffects(fx.combat.onDraw, eventId)
  }
}

function choiceHasAftermath(fx: EffectBundle | undefined): boolean {
  if (!fx) return false
  return Boolean(fx.logExtra || fx.combat || fx.death || fx.setRealm)
}

let missingLogExtra = 0
for (const ev of EVENTS) {
  if (ev.conditions?.traits) {
    for (const tid of ev.conditions.traits) {
      if (!traitIds.has(tid)) {
        orphanTraits.push({ id: tid, eventId: ev.id })
      }
    }
  }
  for (const choice of ev.choices) {
    walkEffects(choice.effects, ev.id)
    if (ev.needsChoice && !choiceHasAftermath(choice.effects)) {
      missingLogExtra += 1
    }
  }
}

const byName = new Map<string, string[]>()
for (const ev of EVENTS) {
  const list = byName.get(ev.name) ?? []
  list.push(ev.id)
  byName.set(ev.name, list)
}
const duplicateNames = [...byName.entries()]
  .filter(([, ids]) => ids.length > 1)
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh'))

const uniqueOrphanTitles = [...new Set(orphanTitles.map((o) => o.id))].sort()
const uniqueOrphanMartial = [...new Set(orphanMartial.map((o) => o.id))].sort()
const uniqueOrphanQueue = [...new Set(orphanQueue.map((o) => o.id))].sort()
const uniqueOrphanTraits = [...new Set(orphanTraits.map((o) => o.id))].sort()

const neverGrantedTitles = TITLES.map((t) => t.id)
  .filter((id) => !grantedTitles.has(id))
  .sort()
const neverGrantedMartial = MARTIAL_ARTS.map((m) => m.id)
  .filter((id) => !addedMartial.has(id))
  .sort()

const collisions = [...traitIds]
  .filter((id) => titleIds.has(id))
  .sort()

const topTitles = [...grantedTitles.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
  .slice(0, 15)

const titleName = (id: string) => TITLES.find((t) => t.id === id)?.name ?? id
const martialName = (id: string) => MARTIAL_ARTS.find((m) => m.id === id)?.name ?? id
const traitName = (id: string) => TRAITS.find((t) => t.id === id)?.name ?? id

const lines = [
  '# 数据引用审计报告（Phase 17 A0 / Phase 22 G4）',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  '## 汇总',
  `- 事件数：${EVENTS.length}`,
  `- 称号表：${TITLES.length} · 武学表：${MARTIAL_ARTS.length} · 特质表：${TRAITS.length}`,
  `- grantTitle 引用次数：${[...grantedTitles.values()].reduce((a, b) => a + b, 0)}（去重 ${grantedTitles.size}）`,
  `- addMartialArt 引用次数：${[...addedMartial.values()].reduce((a, b) => a + b, 0)}（去重 ${addedMartial.size}）`,
  `- 孤儿称号：${uniqueOrphanTitles.length}`,
  `- 孤儿武学：${uniqueOrphanMartial.length}`,
  `- 孤儿 queueEvent/queueEvents：${uniqueOrphanQueue.length}`,
  `- 孤儿 conditions.traits：${uniqueOrphanTraits.length}`,
  `- never-granted 称号：${neverGrantedTitles.length}（软，不失败）`,
  `- never-granted 武学：${neverGrantedMartial.length}（软，不失败）`,
  `- trait↔title id 碰撞：${collisions.length}`,
  `- needsChoice 缺 logExtra/战斗/死亡/境界：${missingLogExtra}（软，不失败）`,
  `- 重复事件名：${duplicateNames.length}（软，不失败）`,
  '',
  '## 孤儿 grantTitle / setPrimaryTitle',
  ...(uniqueOrphanTitles.length === 0
    ? ['（无）']
    : uniqueOrphanTitles.flatMap((id) => {
        const hits = orphanTitles.filter((o) => o.id === id)
        return [
          `- \`${id}\`（${hits.length} 处）`,
          ...hits.map((h) => `  - ${h.eventId} · ${h.field}`),
        ]
      })),
  '',
  '## 孤儿 addMartialArt',
  ...(uniqueOrphanMartial.length === 0
    ? ['（无）']
    : uniqueOrphanMartial.flatMap((id) => {
        const hits = orphanMartial.filter((o) => o.id === id)
        return [
          `- \`${id}\`（${hits.length} 处）`,
          ...hits.map((h) => `  - ${h.eventId}`),
        ]
      })),
  '',
  '## 孤儿 queueEvent / queueEvents',
  ...(uniqueOrphanQueue.length === 0
    ? ['（无）']
    : uniqueOrphanQueue.flatMap((id) => {
        const hits = orphanQueue.filter((o) => o.id === id)
        return [
          `- \`${id}\`（${hits.length} 处）`,
          ...hits.map((h) => `  - ${h.eventId} · ${h.field}`),
        ]
      })),
  '',
  '## 孤儿 conditions.traits',
  ...(uniqueOrphanTraits.length === 0
    ? ['（无）']
    : uniqueOrphanTraits.flatMap((id) => {
        const hits = orphanTraits.filter((o) => o.id === id)
        return [
          `- \`${id}\`（${hits.length} 处）`,
          ...hits.map((h) => `  - ${h.eventId}`),
        ]
      })),
  '',
  '## never-granted 称号（软）',
  ...(neverGrantedTitles.length === 0
    ? ['（无）']
    : neverGrantedTitles.map((id) => `- \`${id}\`（${titleName(id)}）`)),
  '',
  '## never-granted 武学（软）',
  ...(neverGrantedMartial.length === 0
    ? ['（无）']
    : neverGrantedMartial.map((id) => `- \`${id}\`（${martialName(id)}）`)),
  '',
  '## trait ↔ title id 碰撞',
  ...(collisions.length === 0
    ? ['（无）']
    : collisions.map(
        (id) =>
          `- \`${id}\` · 特质「${traitName(id)}」↔ 称号「${titleName(id)}」`,
      )),
  '',
  '## needsChoice 缺余波（软）',
  `- 计数：${missingLogExtra}（无 logExtra / combat / death / setRealm）`,
  '',
  '## 重复事件名（软）',
  ...(duplicateNames.length === 0
    ? ['（无）']
    : duplicateNames.map(
        ([name, ids]) => `- 「${name}」× ${ids.length}：${ids.map((id) => `\`${id}\``).join(', ')}`,
      )),
  '',
  '## 称号发放 Top 15',
  ...topTitles.map(
    ([id, n], i) => `${i + 1}. \`${id}\`（${titleName(id)}）× ${n}`,
  ),
  '',
]

const report = lines.join('\n')
writeFileSync('data-ref-audit-report.md', report, 'utf8')
console.log(report)
console.log('\n已写入 data-ref-audit-report.md')

const hardFail =
  uniqueOrphanTitles.length > 0 ||
  uniqueOrphanMartial.length > 0 ||
  uniqueOrphanQueue.length > 0 ||
  uniqueOrphanTraits.length > 0

if (hardFail) {
  console.error(
    `[data-audit] 发现孤儿：称号 ${uniqueOrphanTitles.length} · 武学 ${uniqueOrphanMartial.length} · 队列 ${uniqueOrphanQueue.length} · 特质 ${uniqueOrphanTraits.length}`,
  )
  process.exitCode = 1
} else {
  console.log('[data-audit] 无引用孤儿')
}

console.log(
  `[data-audit] never-granted 称号 ${neverGrantedTitles.length} · 武学 ${neverGrantedMartial.length}（软，不失败）`,
)
console.log(
  `[data-audit] needsChoice 缺余波 ${missingLogExtra} · 重名 ${duplicateNames.length}（软，不失败）`,
)
