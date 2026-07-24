/**
 * Phase 18 资产 / 薄链高潮审计。
 * 运行：npm run asset-audit
 *
 * 硬失败：高潮/死标缺文件或磁盘孤儿；薄链 imp≥4 未绑 > 0
 * 软报告：立绘缺文件（V2 前）；抉择覆盖率；误绑告警
 */
import { existsSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  ALL_CLIMAX_KEYS,
  CLIMAX_BY_EVENT_ID,
  CLIMAX_TITLE_RULES,
  DEATH_TAG_FINE_KEY,
  ORIGIN_IDS,
  PORTRAIT_ARCHETYPES,
  type ClimaxKey,
} from '../src/data/assetManifest.ts'
import { ORIGINS } from '../src/data/origins.ts'
import { EVENTS } from '../src/data/events.ts'

const ROOT = join(import.meta.dirname, '..')
const ASSETS = join(ROOT, 'public', 'assets')
const THIN = ['escort', 'master', 'force'] as const
type Thin = (typeof THIN)[number]
const ENTRY_KEYS = new Set<ClimaxKey>(['c_escort_entry', 'c_master_entry', 'c_force_entry'])
/** V2 前立绘软失败；之后改为硬失败 */
const PORTRAIT_SOFT = false
/** Phase 19 出身卡：出图前 soft；齐文件后可改 false */
const ORIGIN_SOFT = false
const CHOICE_COVER_TARGET = 0.7

function climaxKeyFromTitle(title: string): ClimaxKey | null {
  for (const rule of CLIMAX_TITLE_RULES) {
    if (rule.re.test(title)) return rule.key
  }
  return null
}

const lines: string[] = []
function log(s = '') {
  lines.push(s)
  console.log(s)
}

let hardFail = false
const softWarns: string[] = []

log('# 资产 / 薄链高潮审计报告')
log()
log(`生成时间：${new Date().toISOString()}`)
log()

// —— 1. climax files ——
log('## 1. 高潮卡文件')
log()
const climaxDir = join(ASSETS, 'climax')
const climaxOnDisk = new Set(
  existsSync(climaxDir)
    ? readdirSync(climaxDir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    : [],
)
const climaxMissing: string[] = []
const climaxMissingEntry: string[] = []
for (const key of ALL_CLIMAX_KEYS) {
  if (!climaxOnDisk.has(key)) {
    if (ENTRY_KEYS.has(key)) climaxMissingEntry.push(key)
    else climaxMissing.push(key)
  }
}
const climaxOrphans = [...climaxOnDisk].filter((k) => !(ALL_CLIMAX_KEYS as string[]).includes(k)).sort()

log(`- Manifest 键：${ALL_CLIMAX_KEYS.length}`)
log(`- 磁盘文件：${climaxOnDisk.size}`)
log(`- 缺文件（非 entry）：${climaxMissing.length ? climaxMissing.join(', ') : '无'}`)
log(`- 缺文件（*_entry，V3 前可占位）：${climaxMissingEntry.length ? climaxMissingEntry.join(', ') : '无'}`)
log(`- 磁盘孤儿：${climaxOrphans.length ? climaxOrphans.join(', ') : '无'}`)
log()

if (climaxMissing.length > 0 || climaxOrphans.length > 0) hardFail = true
if (climaxMissingEntry.length > 0) {
  softWarns.push(`entry 高潮缺文件：${climaxMissingEntry.join(', ')}（V3 出图前请用 mid 占位）`)
  // Prefer disk match via mid→entry copy; if still missing, soft-warn only
}

// —— 2. ending files ——
log('## 2. 死标终局文件')
log()
const endingDir = join(ASSETS, 'ending')
const endingOnDisk = new Set(
  existsSync(endingDir)
    ? readdirSync(endingDir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    : [],
)
const endingExpected = [...new Set(Object.values(DEATH_TAG_FINE_KEY))].map((k) => `e_death_${k}`)
const endingMissing = endingExpected.filter((k) => !endingOnDisk.has(k))
const endingOrphans = [...endingOnDisk]
  .filter((k) => k.startsWith('e_death_') && !endingExpected.includes(k))
  .sort()

log(`- DEATH_TAG_FINE_KEY 值：${endingExpected.length}`)
log(`- 缺文件：${endingMissing.length ? endingMissing.join(', ') : '无'}`)
log(`- 磁盘孤儿：${endingOrphans.length ? endingOrphans.join(', ') : '无'}`)
log()

if (endingMissing.length > 0 || endingOrphans.length > 0) hardFail = true

// —— 3. portraits ——
log('## 3. 立绘矩阵')
log()
const portraitDir = join(ASSETS, 'portrait')
const portraitOnDisk = new Set(
  existsSync(portraitDir)
    ? readdirSync(portraitDir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    : [],
)
const portraitMissing: string[] = []
for (const arch of PORTRAIT_ARCHETYPES) {
  for (const g of ['m', 'f'] as const) {
    const key = `p_${g}_${arch}`
    if (!portraitOnDisk.has(key)) portraitMissing.push(key)
  }
}
log(`- 期望：${PORTRAIT_ARCHETYPES.length * 2}`)
log(`- 磁盘：${portraitOnDisk.size}`)
log(`- 缺文件：${portraitMissing.length ? portraitMissing.join(', ') : '无'}`)
if (portraitMissing.length > 0) {
  if (PORTRAIT_SOFT) {
    softWarns.push(`立绘缺文件（V2 soft）：${portraitMissing.join(', ')}`)
    log(`- 状态：soft-fail（V2 补洞前不硬退出）`)
  } else {
    hardFail = true
    log(`- 状态：hard-fail`)
  }
} else {
  log(`- 状态：齐`)
}
log()

// —— 3b. origin option cards ——
log('## 3b. 出身选项卡')
log()
const originDir = join(ASSETS, 'origin')
const originOnDisk = new Set(
  existsSync(originDir)
    ? readdirSync(originDir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    : [],
)
const originExpected = ORIGIN_IDS.map((id) => `o_${id}`)
const originMissing = originExpected.filter((k) => !originOnDisk.has(k))
const originOrphans = [...originOnDisk]
  .filter((k) => k.startsWith('o_') && !originExpected.includes(k))
  .sort()
const originIdMismatch =
  ORIGIN_IDS.length !== ORIGINS.length || ORIGIN_IDS.some((id, i) => ORIGINS[i]?.id !== id)

log(`- ORIGIN_IDS：${ORIGIN_IDS.length}（origins.ts：${ORIGINS.length}）`)
log(`- 期望文件：${originExpected.join(', ')}`)
log(`- 磁盘：${originOnDisk.size}`)
log(`- 缺文件：${originMissing.length ? originMissing.join(', ') : '无'}`)
log(`- 磁盘孤儿：${originOrphans.length ? originOrphans.join(', ') : '无'}`)
if (originIdMismatch) {
  hardFail = true
  log(`- 状态：ORIGIN_IDS 与 ORIGINS 不同步（hard-fail）`)
} else if (originMissing.length > 0 || originOrphans.length > 0) {
  if (ORIGIN_SOFT) {
    softWarns.push(
      `出身卡缺/孤儿（Phase 19 soft）：缺 ${originMissing.join(', ') || '无'}；孤儿 ${originOrphans.join(', ') || '无'}`,
    )
    log(`- 状态：soft-fail（出图前不硬退出）`)
  } else {
    hardFail = true
    log(`- 状态：hard-fail`)
  }
} else {
  log(`- 状态：齐`)
}
log()

// —— 4. thin-chain mapping ——
log('## 4. 薄链高潮映射')
log()

type Row = {
  id: string
  chain: Thin
  name: string
  imp: number
  needsChoice: boolean
  mapped: ClimaxKey | undefined
}

const thinEvents: Row[] = EVENTS.filter((e) => e.chain && (THIN as readonly string[]).includes(e.chain)).map(
  (e) => ({
    id: e.id,
    chain: e.chain as Thin,
    name: e.name,
    imp: e.importance,
    needsChoice: e.needsChoice,
    mapped: CLIMAX_BY_EVENT_ID[e.id],
  }),
)

log('| 链 | 事件数 | id 已绑 | imp≥4 未绑 | needsChoice∧imp≥3 覆盖 |')
log('|----|--------|---------|------------|------------------------|')

let totalImp4Unmapped = 0
const imp4Lists: string[] = []
let choiceTotal = 0
let choiceMapped = 0

for (const chain of THIN) {
  const xs = thinEvents.filter((r) => r.chain === chain)
  const mapped = xs.filter((r) => r.mapped)
  const imp4 = xs.filter((r) => r.imp >= 4 && !r.mapped)
  const choice = xs.filter((r) => r.needsChoice && r.imp >= 3)
  const choiceOk = choice.filter((r) => r.mapped)
  totalImp4Unmapped += imp4.length
  choiceTotal += choice.length
  choiceMapped += choiceOk.length
  const pct = choice.length ? `${((100 * choiceOk.length) / choice.length).toFixed(1)}%` : 'n/a'
  log(`| ${chain} | ${xs.length} | ${mapped.length} | ${imp4.length} | ${choiceOk.length}/${choice.length} (${pct}) |`)
  for (const r of imp4) {
    imp4Lists.push(`- \`${r.id}\` (${r.chain}, imp=${r.imp}) ${r.name}`)
  }
}

const choicePct = choiceTotal ? choiceMapped / choiceTotal : 1
log()
log(`- 薄链合计事件：${thinEvents.length}；已绑：${thinEvents.filter((r) => r.mapped).length}`)
log(`- imp≥4 未绑合计：${totalImp4Unmapped}`)
log(
  `- needsChoice∧imp≥3 覆盖：${choiceMapped}/${choiceTotal} (${(100 * choicePct).toFixed(1)}%，目标 ≥${CHOICE_COVER_TARGET * 100}%)`,
)
log()

if (imp4Lists.length) {
  log('### imp≥4 未绑清单')
  log()
  for (const s of imp4Lists) log(s)
  log()
}

if (totalImp4Unmapped > 0) hardFail = true
if (choicePct < CHOICE_COVER_TARGET) {
  softWarns.push(
    `抉择覆盖 ${(100 * choicePct).toFixed(1)}% < ${CHOICE_COVER_TARGET * 100}%（DoD 要求；本版应 ≥70%）`,
  )
  // DoD requires ≥70%; treat as hard after V1 mapping should already pass
  hardFail = true
}

// —— 5. misbind ——
log('## 5. 误绑告警（镖路标题→仇敌桶且无 id 映射）')
log()
const misbinds: string[] = []
for (const r of thinEvents.filter((x) => x.chain === 'escort')) {
  const byTitle = climaxKeyFromTitle(r.name)
  if (byTitle === 'c_relation_enemy' && !r.mapped) {
    misbinds.push(`- \`${r.id}\`「${r.name}」标题命中 c_relation_enemy 且无 id 映射`)
  }
}
if (misbinds.length === 0) {
  log('无')
} else {
  for (const s of misbinds) log(s)
  softWarns.push(`误绑告警 ${misbinds.length} 条`)
}
log()

// —— 6. summary ——
log('## 6. 汇总')
log()
if (softWarns.length) {
  log('### Soft warns')
  log()
  for (const w of softWarns) log(`- ${w}`)
  log()
}
log(hardFail ? '**结果：FAIL**（exit 1）' : '**结果：PASS**')
log()

const reportPath = join(ROOT, 'asset-climax-audit-report.md')
writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8')
console.log(`\nWrote ${reportPath}`)

if (hardFail) process.exit(1)
