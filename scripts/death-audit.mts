/**
 * 死因文案种类与寿终占比审计。
 * 运行：npm run death-audit
 */
import { writeFileSync } from 'fs'
import { createBirth, LifeSimulator, buildEnding } from '../src/engine/simulator.ts'
import { DEATH_REASONS } from '../src/lib/deathTags.ts'

const SEEDS = Array.from({ length: 30 }, (_, i) => 70000 + i * 17)
const GENERIC = new Set(['寿终正寝', '死于非命', '江湖陨落'])

const reasonCounts = new Map<string, number>()
let diverseTagRuns = 0
let withRelations = 0
let summaryHasRen = 0

for (const seed of SEEDS) {
  const c = createBirth(seed)
  const sim = new LifeSimulator(c, seed ^ 0xabcdef, 'auto')
  for (let i = 0; i < 250; i++) {
    const r = sim.advanceYear()
    if (r.died) break
  }
  const ending = buildEnding(sim)
  const reason = sim.deathReason || '未知'
  reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  if (ending.endingTags.some((t) => !GENERIC.has(t))) diverseTagRuns += 1
  if (ending.character.relations.length > 0) withRelations += 1
  if (ending.summary.includes('人事')) summaryHasRen += 1
}

const shouzhong = reasonCounts.get('寿元耗尽，寿终正寝') ?? 0
const shouzhongRate = shouzhong / SEEDS.length
const uniqueReasons = [...reasonCounts.keys()]

const lines = [
  '# 死因审计报告',
  '',
  `生成时间：${new Date().toISOString()}`,
  `局数：${SEEDS.length}`,
  '',
  '## 汇总',
  `- 不同死因文案种数：${uniqueReasons.length}`,
  `- 「寿元耗尽，寿终正寝」占比：${(shouzhongRate * 100).toFixed(1)}%（目标 ≤55%）`,
  `- 结局标签非「寿终/非命/陨落」三选一的局：${((diverseTagRuns / SEEDS.length) * 100).toFixed(1)}%（目标 ≥40%）`,
  `- 关系非空局：${((withRelations / SEEDS.length) * 100).toFixed(1)}%（目标 ≥70%）`,
  `- 短传含「人事」：${((summaryHasRen / SEEDS.length) * 100).toFixed(1)}%`,
  `- DEATH_REASONS 池定义种数：${DEATH_REASONS.length}`,
  '',
  '## 死因分布',
  ...[...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `- ${r}：${n}（${((n / SEEDS.length) * 100).toFixed(1)}%）`),
  '',
]

writeFileSync(new URL('../death-audit-report.md', import.meta.url), lines.join('\n'), 'utf8')
console.log(lines.join('\n'))
