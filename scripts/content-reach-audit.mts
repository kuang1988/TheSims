/**
 * 内容触达审计（Phase 22）：量化「库里的事玩家能不能看到、会不会复读」。
 *
 * 口径（写死，勿随意改）：
 * - once 类：以引擎 LifeSimulator.usedOnce 为准（可靠）。
 * - 非 once：以事件本体日志（kind==='event' + eventId）计重复；同次触发的「去向/余波」不计入。
 * - importance<3 且非 once 的事件在全自动下可能不产生事件日志，不据此判定「零触发」。
 *
 * 运行：npm run content-audit
 */
import { writeFileSync } from 'fs'
import { createBirth, LifeSimulator, buildEnding, EVENTS } from '../src/engine/simulator.ts'

const SEEDS = Array.from({ length: 200 }, (_, i) => 70000 + i * 17)
const byId = new Map(EVENTS.map((e) => [e.id, e]))

const SYNERGY_CHAIN_PREFIXES = [
  'synergy_jianxin',
  'synergy_mohe',
  'synergy_shuangxia',
  'synergy_yidao',
  'synergy_zhansha',
]

/** 闸门 = 防回退；愿景 = 立项目标（未达不拦截） */
const GATE_MAX_REPEAT = 4
const GOAL_MAX_REPEAT = 3
const GATE_CLOSEDOOR_AVG = 3
const GOAL_CLOSEDOOR_AVG = 2
const GATE_ONCE_NEVER = 90
const GOAL_ONCE_NEVER = 25
const GATE_COVER = 0.11
const GOAL_COVER = 0.2

let distinctSum = 0
let maxRepeatAny = 0
const closedoorPerLife: number[] = []
const onceFired = new Set<string>()
const fireTotal = new Map<string, number>()
const livesWith = new Map<string, number>()
const synergyLives = new Map<string, number>()
let deathAgeSum = 0

for (const seed of SEEDS) {
  const c = createBirth(seed)
  const sim = new LifeSimulator(c, seed ^ 0xabcdef, 'auto')
  for (let i = 0; i < 250; i++) if (sim.advanceYear().died) break
  const ending = buildEnding(sim)
  deathAgeSum += ending.character.age

  for (const id of sim.usedOnce) if (byId.has(id)) onceFired.add(id)

  const bodyHits = new Map<string, number>()
  for (const l of ending.lifeLog) {
    if (l.kind !== 'event') continue
    const id = l.eventId
    if (!id || !byId.has(id)) continue
    bodyHits.set(id, (bodyHits.get(id) ?? 0) + 1)
  }

  // 用引擎 fireCount（若有）优先；否则回落日志
  const counts = new Map<string, number>()
  for (const e of EVENTS) {
    const n = sim.eventFireCount?.get(e.id) ?? bodyHits.get(e.id) ?? 0
    if (n > 0) counts.set(e.id, n)
  }
  // once 也并入覆盖
  for (const id of sim.usedOnce) if (byId.has(id) && !counts.has(id)) counts.set(id, 1)

  distinctSum += counts.size
  for (const [id, n] of counts) {
    fireTotal.set(id, (fireTotal.get(id) ?? 0) + n)
    livesWith.set(id, (livesWith.get(id) ?? 0) + 1)
    if (n > maxRepeatAny) maxRepeatAny = n
  }
  closedoorPerLife.push(counts.get('mid_closedoor') ?? 0)

  for (const prefix of SYNERGY_CHAIN_PREFIXES) {
    const hit = [...counts.keys()].some((id) => id.startsWith(prefix))
    if (hit) synergyLives.set(prefix, (synergyLives.get(prefix) ?? 0) + 1)
  }
}

const n = SEEDS.length
const onceTotal = EVENTS.filter((e) => e.once).length
const onceNever = EVENTS.filter((e) => e.once && !onceFired.has(e.id))
const cover = distinctSum / n / EVENTS.length
const closedoorAvg =
  closedoorPerLife.reduce((a, b) => a + b, 0) / Math.max(1, closedoorPerLife.filter((x) => x > 0).length)
const closedoorHitLives = closedoorPerLife.filter((x) => x > 0).length
const closedoorMax = Math.max(0, ...closedoorPerLife)

const lines = [
  '# 内容触达审计报告（Phase 22）',
  '',
  `生成时间：${new Date().toISOString()}`,
  `局数：${n}，平均陨落 ${(deathAgeSum / n).toFixed(1)} 岁`,
  '',
  '> 门槛分两档：**闸门**防回退；**愿景**是立项目标，未达如实标注。',
  '',
  '## 汇总',
  `- 单局事件覆盖率：${(cover * 100).toFixed(1)}%（人均 ${(distinctSum / n).toFixed(1)}/${EVENTS.length}；闸门 ≥${GATE_COVER * 100}%；愿景 ≥${GOAL_COVER * 100}%${cover < GOAL_COVER ? ' — 未达' : ''}）`,
  `- once 类零触发：${onceNever.length}/${onceTotal}（闸门 ≤${GATE_ONCE_NEVER}；愿景 ≤${GOAL_ONCE_NEVER}${onceNever.length > GOAL_ONCE_NEVER ? ' — 未达' : ''}）`,
  `- 单局任一事件最大命中：${maxRepeatAny}（闸门 ≤${GATE_MAX_REPEAT}；愿景 ≤${GOAL_MAX_REPEAT}${maxRepeatAny > GOAL_MAX_REPEAT ? ' — 未达' : ''}）`,
  `- mid_closedoor：命中 ${closedoorHitLives}/${n} 局，命中局内均 ${closedoorAvg.toFixed(1)} 次，最多 ${closedoorMax}（闸门均次 ≤${GATE_CLOSEDOOR_AVG}；愿景 ≤${GOAL_CLOSEDOOR_AVG}${closedoorAvg > GOAL_CLOSEDOOR_AVG ? ' — 未达' : ''}）`,
  '',
  '## Synergy 链触达',
  ...SYNERGY_CHAIN_PREFIXES.map((p) => `- ${p}：${synergyLives.get(p) ?? 0}/${n} 局`),
  '',
  '## once 零触发样例（最多 30）',
  ...(onceNever.length
    ? onceNever.slice(0, 30).map((e) => `- ${e.name}（${e.id}）`)
    : ['- （无）']),
  '',
  '## 非 once 高频复读 Top 15（按命中局内均次）',
  ...[...livesWith.entries()]
    .filter(([id]) => !byId.get(id)?.once)
    .map(([id, lives]) => {
      const total = fireTotal.get(id) ?? 0
      return { id, name: byId.get(id)!.name, lives, avg: total / lives, maxHint: total }
    })
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 15)
    .map(
      (r) =>
        `- ${r.name}（${r.id}）：${r.lives}/${n} 局，命中局内均 ${r.avg.toFixed(1)} 次`,
    ),
  '',
]

writeFileSync(new URL('../design/自测报告-内容触达.md', import.meta.url), lines.join('\n'), 'utf8')
console.log(lines.join('\n'))

const fail: string[] = []
if (cover < GATE_COVER) fail.push(`覆盖率 ${(cover * 100).toFixed(1)}% < 闸门 ${GATE_COVER * 100}%`)
if (onceNever.length > GATE_ONCE_NEVER) fail.push(`once 零触发 ${onceNever.length} > 闸门 ${GATE_ONCE_NEVER}`)
if (maxRepeatAny > GATE_MAX_REPEAT) fail.push(`最大复读 ${maxRepeatAny} > 闸门 ${GATE_MAX_REPEAT}`)
if (closedoorAvg > GATE_CLOSEDOOR_AVG) {
  fail.push(`closedoor 均次 ${closedoorAvg.toFixed(1)} > 闸门 ${GATE_CLOSEDOOR_AVG}`)
}
const synergyHit = SYNERGY_CHAIN_PREFIXES.filter((p) => (synergyLives.get(p) ?? 0) > 0).length
if (synergyHit < 3) fail.push(`synergy 链触达仅 ${synergyHit}/5（闸门至少 3 条有触达）`)

const unmet: string[] = []
if (cover < GOAL_COVER) unmet.push(`覆盖率 愿景 ≥${GOAL_COVER * 100}%`)
if (onceNever.length > GOAL_ONCE_NEVER) unmet.push(`once 零触发 愿景 ≤${GOAL_ONCE_NEVER}`)
if (maxRepeatAny > GOAL_MAX_REPEAT) unmet.push(`最大复读 愿景 ≤${GOAL_MAX_REPEAT}`)
if (closedoorAvg > GOAL_CLOSEDOOR_AVG) unmet.push(`closedoor 均次 愿景 ≤${GOAL_CLOSEDOOR_AVG}`)

if (fail.length) {
  console.error('\n[content-audit] 闸门未过：\n- ' + fail.join('\n- '))
  process.exitCode = 1
} else {
  console.log('\n[content-audit] 闸门通过')
  if (unmet.length) {
    console.log('[content-audit] 愿景仍未达成：\n- ' + unmet.join('\n- '))
  }
}
