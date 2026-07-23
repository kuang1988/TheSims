import { EVENTS } from '../src/data/events.ts'
import { TRAITS } from '../src/data/traits.ts'
import { writeFileSync } from 'fs'

/** 自动抉择/濒死等引擎层特殊处理（非 conditions.traits） */
const AUTO_TRAITS = new Set([
  'tanlan',
  'renxin',
  'haoxia',
  'mozhong',
  'yixian',
  'zhanshen',
  'fushen',
  'qiongxiang',
  'nvxia',
  'foyuan',
  'lengxue',
  'kuangdao',
  'wenrou',
  'yeguai',
  'jueqing',
  'tianjiao',
  'shuangtong',
  'lingxi',
  'canfei',
])

const traitHits = Object.fromEntries(
  TRAITS.map((t) => [t.id, { name: t.name, cond: 0, auto: AUTO_TRAITS.has(t.id) ? 1 : 0 }]),
) as Record<string, { name: string; cond: number; auto: number }>

for (const ev of EVENTS) {
  for (const t of ev.conditions?.traits ?? []) {
    if (traitHits[t]) traitHits[t].cond++
  }
}

const entries = Object.entries(traitHits)
const withCond = entries.filter(([, v]) => v.cond > 0)
const onlyMods = entries.filter(([, v]) => v.cond === 0 && v.auto === 0)
const onlyAuto = entries.filter(([, v]) => v.cond === 0 && v.auto > 0)

let heart = 0
let force = 0
let traits = 0
for (const ev of EVENTS) {
  const c = ev.conditions
  if (!c) continue
  if (c.heartTiers || c.minHeart != null || c.maxHeart != null) heart++
  if (c.minForce != null) force++
  if (c.traits) traits++
}

const out = {
  traitTotal: TRAITS.length,
  withCondCount: withCond.length,
  onlyAuto: onlyAuto.map(([id, v]) => ({ id, name: v.name })),
  modsOnly: onlyMods.map(([id, v]) => ({ id, name: v.name })),
  eventsHeart: heart,
  eventsForce: force,
  eventsTrait: traits,
  withCondDetail: withCond.map(([id, v]) => ({ id, name: v.name, cond: v.cond })),
}
writeFileSync('attr-audit.json', JSON.stringify(out, null, 2))
console.log(
  JSON.stringify(
    {
      traitTotal: out.traitTotal,
      withCondCount: out.withCondCount,
      modsOnlyCount: out.modsOnly.length,
      modsOnly: out.modsOnly,
      eventsTrait: out.eventsTrait,
    },
    null,
    2,
  ),
)
