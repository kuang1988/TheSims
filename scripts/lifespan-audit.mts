/**
 * 寿数审计（Phase 21）：量化「角色能不能活到老」。
 *
 * death-audit 管「死得叫什么名目」，本脚本管「死得太早没有」——
 * 逐年快照 flags，把陨落归因到具体漏斗，并给出存活曲线。
 *
 * 运行：npm run lifespan-audit
 */
import { writeFileSync } from 'fs'
import { createBirth, LifeSimulator, buildEnding } from '../src/engine/simulator.ts'
import { primaryDeathTag } from '../src/lib/deathTags.ts'

const SEEDS = Array.from({ length: 200 }, (_, i) => 70000 + i * 17)

/** 受关注的致死烙印：按优先级排序，取第一个命中者作为漏斗归因 */
const FUNNEL_FLAGS = [
  'closedoor_risk',
  'heaven_failed',
  'heaven_scar',
  'qi_deviation',
  'meridian_gamble',
  'betrayal_pursuit',
  'revenge_pursuit',
  'sect_martyr',
  'severe_wound',
  'battle_wounded',
  'inner_risk',
] as const

const MILESTONES = [30, 40, 50, 60, 70, 80] as const

/**
 * 闸门 = 防回退水位（取 Phase 21 F1/F2 交付后的实测值下沿）；
 * 愿景 = 立项时定的产品目标，尚未达成，保留在报告里作为后续 Sprint 的靶子。
 * 刻意分开：闸门用于 CI 拦截回退，愿景不因跑不到而调低。
 */
const GATE_DEATH_AGE = 60
const GOAL_DEATH_AGE = 65
const GATE_REACH = 0.18
const GOAL_REACH = 0.25
const GATE_TOP_FUNNEL = 0.22
/** 烙印落地距陨落多少年以内才算「死因近因」 */
const RECENT_YEARS = 5

let deathAgeSum = 0
let lifespanSum = 0
let reachedLifespan = 0
const survivedTo = new Map<number, number>(MILESTONES.map((m) => [m, 0]))
const funnelCounts = new Map<string, number>()
const funnelGapSum = new Map<string, number>()
const tagCounts = new Map<string, number>()
const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n)

for (const seed of SEEDS) {
  const c = createBirth(seed)
  const sim = new LifeSimulator(c, seed ^ 0xabcdef, 'auto')

  const lastGainAge: Record<string, number | null> = {}
  for (const f of FUNNEL_FLAGS) lastGainAge[f] = null
  let prev = new Set(c.flags)

  for (let i = 0; i < 250; i++) {
    const r = sim.advanceYear()
    const now = new Set(c.flags)
    for (const f of FUNNEL_FLAGS) if (now.has(f) && !prev.has(f)) lastGainAge[f] = c.age
    prev = now
    if (r.died) break
  }

  const ending = buildEnding(sim)
  const ch = ending.character
  const reason = (sim.deathReason || '未知').split('\n')[0]!.trim()
  const deathAge = ending.lifeLog.find((l) => l.kind === 'death')?.age ?? ch.age

  deathAgeSum += deathAge
  lifespanSum += ch.lifespan
  if (ch.age >= ch.lifespan) reachedLifespan += 1
  for (const m of MILESTONES) if (deathAge >= m) survivedTo.set(m, (survivedTo.get(m) ?? 0) + 1)

  bump(tagCounts, primaryDeathTag(reason, ch))

  // 漏斗归因：只认「近因」烙印。落地已逾 RECENT_YEARS 的旗属陈年背景，
  // 把它算成死因会把自然衰亡误报成漏斗（如持旗十余年的 inner_risk）。
  let best: { flag: string; gap: number } | null = null
  for (const f of FUNNEL_FLAGS) {
    if (!ch.flags.includes(f) || lastGainAge[f] == null) continue
    const gap = deathAge - lastGainAge[f]!
    if (gap > RECENT_YEARS) continue
    if (!best || gap < best.gap) best = { flag: f, gap }
  }
  const key = best ? best.flag : '（无近因烙印·自然衰亡）'
  bump(funnelCounts, key)
  bump(funnelGapSum, key, best ? best.gap : 0)
}

const n = SEEDS.length
const avgDeathAge = deathAgeSum / n
const avgLifespan = lifespanSum / n
const reachRate = reachedLifespan / n

const lines = [
  '# 寿数审计报告（Phase 21）',
  '',
  `生成时间：${new Date().toISOString()}`,
  `局数：${n}`,
  '',
  '> 门槛分两档：**闸门**锁住当前水位、防止回退；**愿景**是 Phase 21 立项时定的产品目标，',
  '> 未达成时如实显示为「未达」，不因跑不到就调低。',
  '',
  '## 汇总',
  `- 平均陨落年龄：${avgDeathAge.toFixed(1)} 岁（闸门 ≥${GATE_DEATH_AGE}；愿景 ≥${GOAL_DEATH_AGE}${avgDeathAge < GOAL_DEATH_AGE ? ' — 未达' : ''}）`,
  `- 平均寿元：${avgLifespan.toFixed(1)} 岁`,
  `- 早夭差值（寿元 − 实际）：${(avgLifespan - avgDeathAge).toFixed(1)} 年`,
  `- 活到寿元率：${(reachRate * 100).toFixed(1)}%（${reachedLifespan}/${n}；闸门 ≥${GATE_REACH * 100}%；愿景 ≥${GOAL_REACH * 100}%${reachRate < GOAL_REACH ? ' — 未达' : ''}）`,
  '',
  '## 存活曲线',
  ...MILESTONES.map((m) => {
    const v = survivedTo.get(m) ?? 0
    return `- 活过 ${m} 岁：${((v / n) * 100).toFixed(1)}%（${v}/${n}）`
  }),
  '',
  `## 陨落漏斗归因（死前 ${RECENT_YEARS} 年内落地的近因烙印）`,
  ...[...funnelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const gap = (funnelGapSum.get(k) ?? 0) / v
      return `- ${k}：${v}（${((v / n) * 100).toFixed(1)}%），落地→陨落均隔 ${gap.toFixed(1)} 年`
    }),
  '',
  '## 主死标分布',
  ...[...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}：${v}（${((v / n) * 100).toFixed(1)}%）`),
  '',
]

writeFileSync(new URL('../design/自测报告-寿数.md', import.meta.url), lines.join('\n'), 'utf8')
console.log(lines.join('\n'))

const fail: string[] = []
if (avgDeathAge < GATE_DEATH_AGE) {
  fail.push(`平均陨落年龄 ${avgDeathAge.toFixed(1)} < 闸门 ${GATE_DEATH_AGE}`)
}
if (reachRate < GATE_REACH) {
  fail.push(`活到寿元率 ${(reachRate * 100).toFixed(1)}% < 闸门 ${GATE_REACH * 100}%`)
}
const topFunnel = [...funnelCounts.entries()]
  .filter(([k]) => k !== '（无近因烙印·自然衰亡）')
  .sort((a, b) => b[1] - a[1])[0]
if (topFunnel && topFunnel[1] / n > GATE_TOP_FUNNEL) {
  fail.push(
    `单一漏斗 ${topFunnel[0]} ${((topFunnel[1] / n) * 100).toFixed(1)}% > 闸门 ${GATE_TOP_FUNNEL * 100}%`,
  )
}

const unmet: string[] = []
if (avgDeathAge < GOAL_DEATH_AGE) unmet.push(`平均陨落年龄 愿景 ≥${GOAL_DEATH_AGE}`)
if (reachRate < GOAL_REACH) unmet.push(`活到寿元率 愿景 ≥${GOAL_REACH * 100}%`)

if (fail.length) {
  console.error('\n[lifespan-audit] 闸门未过（出现回退）：\n- ' + fail.join('\n- '))
  process.exitCode = 1
} else {
  console.log('\n[lifespan-audit] 闸门通过')
  if (unmet.length) {
    console.log('[lifespan-audit] 愿景仍未达成（不拦截，留给后续 Sprint）：\n- ' + unmet.join('\n- '))
  }
}
