/**
 * 死因文案种类、精标分布、寿终通路与身份一致性审计。
 * 运行：npm run death-audit
 */
import { writeFileSync } from 'fs'
import { createBirth, LifeSimulator, buildEnding } from '../src/engine/simulator.ts'
import {
  DEATH_REASONS,
  FINE_DEATH_TAGS,
  deathIdentityMismatch,
  primaryDeathTag,
} from '../src/lib/deathTags.ts'

const SEEDS = Array.from({ length: 30 }, (_, i) => 70000 + i * 17)
const GENERIC = new Set(['寿终正寝', '死于非命', '江湖陨落'])

const reasonCounts = new Map<string, number>()
const primaryTagCounts = new Map<string, number>()
let diverseTagRuns = 0
let withRelations = 0
let summaryHasRen = 0
let mismatchCount = 0
const mismatches: string[] = []

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

  const primary = primaryDeathTag(reason, ending.character)
  primaryTagCounts.set(primary, (primaryTagCounts.get(primary) ?? 0) + 1)

  if (ending.endingTags.some((t) => !GENERIC.has(t))) diverseTagRuns += 1
  if (ending.character.relations.length > 0) withRelations += 1
  if (ending.summary.includes('人事')) summaryHasRen += 1

  const mm = deathIdentityMismatch(reason, ending.character)
  if (mm) {
    mismatchCount += 1
    mismatches.push(`种子${seed} · ${reason} · ${mm}`)
  }
}

const shouzhongReasons = [...reasonCounts.entries()].filter(
  ([r]) =>
    r.includes('寿终') ||
    r.includes('坐化') ||
    r.includes('无疾而终') ||
    r.includes('狱中而终'),
)
const shouzhongN = shouzhongReasons.reduce((s, [, n]) => s + n, 0)
const shouzhongRate = shouzhongN / SEEDS.length
const feimingN = primaryTagCounts.get('死于非命') ?? 0
const feimingRate = feimingN / SEEDS.length
const uniqueReasons = [...reasonCounts.keys()]
const fineTouched = [...primaryTagCounts.keys()].filter((t) =>
  (FINE_DEATH_TAGS as readonly string[]).includes(t),
)
const mismatchRate = mismatchCount / SEEDS.length

const lines = [
  '# 死因审计报告（Phase 8）',
  '',
  `生成时间：${new Date().toISOString()}`,
  `局数：${SEEDS.length}`,
  '',
  '## 汇总',
  `- 不同死因文案种数：${uniqueReasons.length}（目标 ≥8）`,
  `- 寿终类文案合计占比：${(shouzhongRate * 100).toFixed(1)}%（目标 15%～45%）`,
  `- 主死标「死于非命」占比：${(feimingRate * 100).toFixed(1)}%（目标 ≤25%）`,
  `- 精死标触达种数：${fineTouched.length}（目标 ≥8）`,
  `- 身份 mismatch 占比：${(mismatchRate * 100).toFixed(1)}%（目标 ≤25%）`,
  `- 结局标签非「寿终/非命/陨落」三选一的局：${((diverseTagRuns / SEEDS.length) * 100).toFixed(1)}%（辅助）`,
  `- 关系非空局：${((withRelations / SEEDS.length) * 100).toFixed(1)}%`,
  `- 短传含「人事」：${((summaryHasRen / SEEDS.length) * 100).toFixed(1)}%`,
  `- DEATH_REASONS 池定义种数：${DEATH_REASONS.length}`,
  '',
  '## 主死标分布',
  ...[...primaryTagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `- ${r}：${n}（${((n / SEEDS.length) * 100).toFixed(1)}%）`),
  '',
  '## 死因文案分布',
  ...[...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `- ${r}：${n}（${((n / SEEDS.length) * 100).toFixed(1)}%）`),
  '',
  '## 身份 mismatch 样本',
  ...(mismatches.length ? mismatches.map((m) => `- ${m}`) : ['- （无）']),
  '',
]

writeFileSync(new URL('../death-audit-report.md', import.meta.url), lines.join('\n'), 'utf8')
console.log(lines.join('\n'))

const fail: string[] = []
if (uniqueReasons.length < 8) fail.push(`文案种数 ${uniqueReasons.length} < 8`)
if (shouzhongRate < 0.15 || shouzhongRate > 0.45) {
  fail.push(`寿终类 ${(shouzhongRate * 100).toFixed(1)}% 不在 15～45%`)
}
if (feimingRate > 0.25) fail.push(`死于非命主标 ${(feimingRate * 100).toFixed(1)}% > 25%`)
if (fineTouched.length < 8) fail.push(`精标触达 ${fineTouched.length} < 8`)
if (mismatchRate > 0.25) fail.push(`mismatch ${(mismatchRate * 100).toFixed(1)}% > 25%`)

if (fail.length) {
  console.error('\n[death-audit] 未达标：\n- ' + fail.join('\n- '))
  process.exitCode = 1
} else {
  console.log('\n[death-audit] 全部门槛通过')
}
