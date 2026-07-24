/**
 * 死因文案种类、精标分布、寿终通路、凡尘分桶与身份一致性审计。
 * Phase 20 另计：突兀/铺垫指标。
 * 运行：npm run death-audit
 */
import { writeFileSync } from 'fs'
import { createBirth, LifeSimulator, buildEnding } from '../src/engine/simulator.ts'
import {
  DEATH_REASONS,
  FINE_DEATH_TAGS,
  civicArcDeathMatch,
  deathIdentityMismatch,
  deathSoftMismatch,
  isPeacefulDeathReason,
  isCivicPeacefulDeath,
  primaryDeathTag,
} from '../src/lib/deathTags.ts'
import { hasDeathPaceFlag } from '../src/lib/deathPace.ts'
import { CIVIC_FINALE_FLAGS } from '../src/lib/civicPath.ts'

const SEEDS = Array.from({ length: 40 }, (_, i) => 70000 + i * 17)
const GENERIC = new Set(['寿终正寝', '死于非命', '江湖陨落'])
const CIVIC_MAINLINES = new Set(['士途', '农桑', '市井', '商途', '江湖客'])

const reasonCounts = new Map<string, number>()
const primaryTagCounts = new Map<string, number>()
let diverseTagRuns = 0
let withRelations = 0
let summaryHasRen = 0
let mismatchCount = 0
let softMismatchCount = 0
const mismatches: string[] = []
const softMismatches: string[] = []

let civicMainlineN = 0
let civicPeacefulN = 0
let civicFinaleN = 0
let civicFinaleMatchN = 0
let civicFinaleReachN = 0
let noMajorN = 0

let pacedDeathN = 0
let abruptBreakthroughN = 0
let breakthroughDeathN = 0
let systemDeathNoFarewellN = 0
let systemDeathN = 0

let narrativeRewrittenN = 0
const narrativeRewrites: string[] = []

for (const seed of SEEDS) {
  const c = createBirth(seed)
  const sim = new LifeSimulator(c, seed ^ 0xabcdef, 'auto')
  for (let i = 0; i < 250; i++) {
    const r = sim.advanceYear()
    if (r.died) break
  }
  const ending = buildEnding(sim)
  const ch = ending.character
  const reason = (sim.deathReason || '未知').split('\n')[0]!.trim()
  reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)

  const primary = primaryDeathTag(reason, ch)
  primaryTagCounts.set(primary, (primaryTagCounts.get(primary) ?? 0) + 1)

  if (ending.endingTags.some((t) => !GENERIC.has(t))) diverseTagRuns += 1
  if (ch.relations.length > 0) withRelations += 1
  if (ending.summary.includes('人事')) summaryHasRen += 1

  const mm = deathIdentityMismatch(reason, ch)
  if (mm) {
    mismatchCount += 1
    mismatches.push(`种子${seed} · ${reason} · ${mm}`)
  }
  const sm = deathSoftMismatch(reason, ch, ending.mainline)
  if (sm) {
    softMismatchCount += 1
    softMismatches.push(`种子${seed} · ${ending.mainline} · ${reason} · ${sm}`)
  }

  const isCivicMain = CIVIC_MAINLINES.has(ending.mainline)
  if (isCivicMain) {
    civicMainlineN += 1
    if (isCivicPeacefulDeath(reason)) civicPeacefulN += 1
  }

  const hasFinale = CIVIC_FINALE_FLAGS.some((f) => ch.flags.includes(f))
  if (hasFinale) {
    civicFinaleN += 1
    const match = civicArcDeathMatch(reason, ch)
    if (match) civicFinaleMatchN += 1
  }

  const major =
    ch.flags.some((f) =>
      [
        'sect_huashan',
        'sect_wudang',
        'sect_shaolin',
        'sect_emei',
        'sect_gaibang',
        'gaibang_member',
        'demon_sect',
        'demon_loyal',
        'demon_lord',
        'became_bandit',
        'bandit_finale',
      ].includes(f),
    ) && !ch.flags.includes('left_sect')
  if (!major) {
    noMajorN += 1
    if (hasFinale) civicFinaleReachN += 1
  }

  if (
    hasDeathPaceFlag(ch) ||
    ending.lifeLog.some(
      (l) =>
        l.title === '大限将至' ||
        l.title === '残灯将尽' ||
        (l.kind === 'death' && l.text.includes('\n')),
    )
  ) {
    pacedDeathN += 1
  }

  const isBreakthrough = /突破失败|走火/.test(reason) || primary === '突破失败'
  if (isBreakthrough) {
    breakthroughDeathN += 1
    const hasDebt =
      ch.flags.includes('inner_risk') ||
      ch.flags.includes('broke_through') ||
      ch.flags.includes('omen_breakthrough_done') ||
      ch.flags.includes('qi_deviation')
    if (!hasDebt) abruptBreakthroughN += 1
  }

  const isSystem =
    /寿终|坐化|无疾|隐世|宗师善终|狱中而终|病榻|沉疴|劳伤|伤重不治|体魄崩解/.test(reason) ||
    ['寿终正寝', '隐世而终', '宗师善终', '狱中而终', '病榻而终', '伤重不治'].includes(primary)
  if (isSystem) {
    systemDeathN += 1
    const hasFarewell =
      ch.flags.includes('lifespan_farewell') ||
      ch.flags.includes('body_farewell') ||
      ch.flags.includes('omen_lifespan_done') ||
      ending.lifeLog.some(
        (l) =>
          l.title === '大限将至' ||
          l.title === '残灯将尽' ||
          (l.kind === 'death' && l.text.includes('\n')),
      )
    if (!hasFarewell) systemDeathNoFarewellN += 1
  }

  // 同岁败战/天劫却写成善终
  if (isPeacefulDeathReason(reason)) {
    const deathAge = ending.lifeLog.find((l) => l.kind === 'death')?.age ?? ch.age
    const sameYearCombatLoss = ending.lifeLog.some(
      (l) => l.age === deathAge && (l.title === '冲突·惨败' || l.title === '冲突·两败'),
    )
    const sameYearTribulation = ending.lifeLog.some(
      (l) => l.age === deathAge && (l.title === '天劫将至' || l.title.includes('天劫将至')),
    )
    if (
      sameYearCombatLoss ||
      sameYearTribulation ||
      ch.flags.includes('heaven_failed') ||
      (ch.flags.includes('qi_deviation') && sameYearCombatLoss)
    ) {
      narrativeRewrittenN += 1
      narrativeRewrites.push(
        `种子${seed} · ${reason} · 败战=${sameYearCombatLoss} · 天劫=${sameYearTribulation} · 烙印[${ch.flags.filter((f) => ['battle_wounded', 'severe_wound', 'final_duel', 'meridian_gamble', 'heaven_ok', 'heaven_failed', 'qi_deviation'].includes(f)).join(',')}]`,
      )
    }
  }
}

const shouzhongN =
  (primaryTagCounts.get('寿终正寝') ?? 0) +
  (primaryTagCounts.get('隐世而终') ?? 0) +
  (primaryTagCounts.get('宗师善终') ?? 0) +
  (primaryTagCounts.get('狱中而终') ?? 0)
const shouzhongRate = shouzhongN / SEEDS.length
const feimingN = primaryTagCounts.get('死于非命') ?? 0
const feimingRate = feimingN / SEEDS.length
const betrayalN = primaryTagCounts.get('门人反噬') ?? 0
const betrayalRate = betrayalN / SEEDS.length
const uniqueReasons = [...reasonCounts.keys()]
const fineTouched = [...primaryTagCounts.keys()].filter((t) =>
  (FINE_DEATH_TAGS as readonly string[]).includes(t),
)
const mismatchRate = mismatchCount / SEEDS.length
const softMismatchRate = softMismatchCount / SEEDS.length
const topTag = [...primaryTagCounts.entries()].sort((a, b) => b[1] - a[1])[0]
const topTagRate = (topTag?.[1] ?? 0) / SEEDS.length
const civicMainRate = civicMainlineN / SEEDS.length
const civicPeacefulRate = civicMainlineN ? civicPeacefulN / civicMainlineN : 0
const civicArcMatchRate = civicFinaleN ? civicFinaleMatchN / civicFinaleN : 1
const civicFinaleReachRate = noMajorN ? civicFinaleReachN / noMajorN : 0

const pacedRate = pacedDeathN / SEEDS.length
const abruptBreakthroughRate = breakthroughDeathN ? abruptBreakthroughN / breakthroughDeathN : 0
const systemNoFarewellRate = systemDeathN ? systemDeathNoFarewellN / systemDeathN : 0

const lines = [
  '# 死因审计报告（Phase 20）',
  '',
  `生成时间：${new Date().toISOString()}`,
  `局数：${SEEDS.length}`,
  '',
  '## 汇总',
  `- 不同死因文案种数：${uniqueReasons.length}（目标 ≥8）`,
  `- 寿终类精标占比：${(shouzhongRate * 100).toFixed(1)}%（目标 15%～65%）`,
  `- 主死标「死于非命」占比：${(feimingRate * 100).toFixed(1)}%（目标 ≤25%）`,
  `- 主死标「门人反噬」占比：${(betrayalRate * 100).toFixed(1)}%（目标 ≤18%）`,
  `- 单一主死标霸榜：${topTag?.[0] ?? '-'} ${(topTagRate * 100).toFixed(1)}%（目标 ≤28%）`,
  `- 精死标触达种数：${fineTouched.length}（目标 ≥8）`,
  `- 身份硬 mismatch 占比：${(mismatchRate * 100).toFixed(1)}%（目标 ≤25%）`,
  `- 软违和 softMismatch 占比：${(softMismatchRate * 100).toFixed(1)}%（目标 ≤20%）`,
  `- 凡尘主线占比：${(civicMainRate * 100).toFixed(1)}%（目标 ≥25%）`,
  `- 凡尘主线善终占比：${(civicPeacefulRate * 100).toFixed(1)}%（目标 ≥45%，分母=${civicMainlineN}）`,
  `- 凡尘归宿触达（未入主族）：${(civicFinaleReachRate * 100).toFixed(1)}%（目标 ≥55%，分母=${noMajorN}）`,
  `- 弧绑定死匹配：${(civicArcMatchRate * 100).toFixed(1)}%（目标 ≥80%，分母=${civicFinaleN}）`,
  `- 结局标签非「寿终/非命/陨落」三选一的局：${((diverseTagRuns / SEEDS.length) * 100).toFixed(1)}%（辅助）`,
  `- 关系非空局：${((withRelations / SEEDS.length) * 100).toFixed(1)}%`,
  `- 短传含「人事」：${((summaryHasRen / SEEDS.length) * 100).toFixed(1)}%`,
  `- DEATH_REASONS 池定义种数：${DEATH_REASONS.length}`,
  '',
  '## Phase 20 终局连贯',
  `- 有铺垫/绝笔局：${(pacedRate * 100).toFixed(1)}%（目标 ≥70%，${pacedDeathN}/${SEEDS.length}）`,
  `- 破境死无债：${abruptBreakthroughN}/${breakthroughDeathN || 0}（目标 0；比率 ${(abruptBreakthroughRate * 100).toFixed(1)}%）`,
  `- 系统死无仪式：${systemDeathNoFarewellN}/${systemDeathN || 0}（目标 ≤20%；比率 ${(systemNoFarewellRate * 100).toFixed(1)}%）`,
  `- 同岁恶斗却善终：${narrativeRewrittenN}（目标 0）`,
  ...(narrativeRewrites.length ? narrativeRewrites.slice(0, 12).map((m) => `  - ${m}`) : ['  - （无）']),
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
  '## 软违和样本',
  ...(softMismatches.length ? softMismatches.slice(0, 20).map((m) => `- ${m}`) : ['- （无）']),
  '',
]

writeFileSync(new URL('../death-audit-report.md', import.meta.url), lines.join('\n'), 'utf8')
console.log(lines.join('\n'))

const fail: string[] = []
if (uniqueReasons.length < 8) fail.push(`文案种数 ${uniqueReasons.length} < 8`)
if (shouzhongRate < 0.15 || shouzhongRate > 0.65) {
  fail.push(`寿终类精标 ${(shouzhongRate * 100).toFixed(1)}% 不在 15～65%`)
}
if (feimingRate > 0.25) fail.push(`死于非命主标 ${(feimingRate * 100).toFixed(1)}% > 25%`)
if (betrayalRate > 0.18) fail.push(`门人反噬 ${(betrayalRate * 100).toFixed(1)}% > 18%`)
if (topTagRate > 0.28) fail.push(`霸榜 ${topTag?.[0]} ${(topTagRate * 100).toFixed(1)}% > 28%`)
if (fineTouched.length < 8) fail.push(`精标触达 ${fineTouched.length} < 8`)
if (mismatchRate > 0.25) fail.push(`mismatch ${(mismatchRate * 100).toFixed(1)}% > 25%`)
if (softMismatchRate > 0.2) fail.push(`softMismatch ${(softMismatchRate * 100).toFixed(1)}% > 20%`)
if (civicMainRate < 0.2) fail.push(`凡尘主线 ${(civicMainRate * 100).toFixed(1)}% < 20%`)
if (civicMainlineN >= 5 && civicPeacefulRate < 0.45) {
  fail.push(`凡尘善终 ${(civicPeacefulRate * 100).toFixed(1)}% < 45%`)
}
if (noMajorN >= 8 && civicFinaleReachRate < 0.55) {
  fail.push(`归宿触达 ${(civicFinaleReachRate * 100).toFixed(1)}% < 55%`)
}
if (civicFinaleN >= 5 && civicArcMatchRate < 0.8) {
  fail.push(`弧绑定 ${(civicArcMatchRate * 100).toFixed(1)}% < 80%`)
}
if (pacedRate < 0.7) fail.push(`有铺垫局 ${(pacedRate * 100).toFixed(1)}% < 70%`)
if (abruptBreakthroughN > 0) {
  fail.push(`破境死无债 ${abruptBreakthroughN} > 0`)
}
if (systemDeathN >= 8 && systemNoFarewellRate > 0.2) {
  fail.push(`系统死无仪式 ${(systemNoFarewellRate * 100).toFixed(1)}% > 20%`)
}
if (narrativeRewrittenN > 0) {
  fail.push(`同岁恶斗却善终 ${narrativeRewrittenN} > 0`)
}

if (fail.length) {
  console.error('\n[death-audit] 未达标：\n- ' + fail.join('\n- '))
  process.exitCode = 1
} else {
  console.log('\n[death-audit] 全部门槛通过')
}
