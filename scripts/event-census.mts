/**
 * 事件池盘点。运行：npm run event-census
 */
import { writeFileSync } from 'fs'
import { EVENTS } from '../src/data/events.ts'
import {
  PHASE16_ESCORT_EVENTS,
  PHASE16_MASTER_EVENTS,
  PHASE16_FORCE_EVENTS,
} from '../src/data/phase16Events.ts'
import { PHASE17_EVENTS } from '../src/data/phase17Events.ts'

/** Phase 16 交付基线 */
const BASELINE_P16 = 559
/** Phase 17 目标：至少 +60 */
const TARGET = BASELINE_P16 + 60

const byImp: Record<string, number> = {}
const byChain: Record<string, number> = {}
const byStage: Record<string, number> = {}
const byTag: Record<string, number> = {}
let once = 0
let needsChoice = 0

for (const e of EVENTS) {
  byImp[String(e.importance)] = (byImp[String(e.importance)] ?? 0) + 1
  const chain = e.chain ?? '(none)'
  byChain[chain] = (byChain[chain] ?? 0) + 1
  if (e.once) once += 1
  if (e.needsChoice) needsChoice += 1
  for (const s of e.stages) byStage[s] = (byStage[s] ?? 0) + 1
  for (const t of e.tags) byTag[t] = (byTag[t] ?? 0) + 1
}

const sortEntries = (m: Record<string, number>) =>
  Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))

const escortChain = byChain['escort'] ?? 0
const masterChain = byChain['master'] ?? 0
const forceChain = byChain['force'] ?? 0

const lines = [
  '# 事件盘点报告（Phase 17）',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  '## 汇总',
  `- 事件总数：${EVENTS.length}（P16 基线 ${BASELINE_P16}，净增 ${EVENTS.length - BASELINE_P16}，目标 ≥${TARGET}）`,
  `- Phase 17 本批：${PHASE17_EVENTS.length}`,
  `- needsChoice：${needsChoice}`,
  `- once：${once}`,
  '',
  '## Phase 16 薄链（软检）',
  `- escort chain：${escortChain}（本批 ${PHASE16_ESCORT_EVENTS.length}，目标 ≥28）`,
  `- master chain：${masterChain}（本批 ${PHASE16_MASTER_EVENTS.length}，目标 ≥28）`,
  `- force chain：${forceChain}（本批 ${PHASE16_FORCE_EVENTS.length}，目标 ≥18）`,
  `- 幼年 stage 触达：${byStage['幼年'] ?? 0}`,
  '',
  '## importance',
  ...sortEntries(byImp).map(([k, v]) => `- ${k}：${v}`),
  '',
  '## chain',
  ...sortEntries(byChain).map(([k, v]) => `- ${k}：${v}`),
  '',
  '## stages（可重复计）',
  ...sortEntries(byStage).map(([k, v]) => `- ${k}：${v}`),
  '',
  '## tags Top 25',
  ...sortEntries(byTag)
    .slice(0, 25)
    .map(([k, v]) => `- ${k}：${v}`),
  '',
]

const report = lines.join('\n')
writeFileSync('event-census-report.md', report, 'utf8')
console.log(report)
console.log('\n已写入 event-census-report.md')

if (EVENTS.length < TARGET) {
  console.error(`[event-census] 未达门槛：当前 ${EVENTS.length} < ${TARGET}`)
  process.exitCode = 1
}

if (escortChain < 28 || masterChain < 28 || forceChain < 18) {
  console.warn(
    `[event-census] 薄链软检：escort=${escortChain} master=${masterChain} force=${forceChain}`,
  )
}
