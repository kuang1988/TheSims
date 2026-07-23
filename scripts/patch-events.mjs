import fs from 'fs'

const path = 'src/data/events.ts'
let s = fs.readFileSync(path, 'utf8')

const replacements = [
  [
    "addFlags: ['has_wuguan', 'path_chosen']",
    "addFlags: ['has_wuguan']",
  ],
  [
    "conditions: { forbidFlags: ['path_chosen', 'sect_outer', 'small_sect', 'wanderer', 'demon_sect', 'became_bandit'] }",
    "conditions: { forbidFlags: ['sect_outer', 'small_sect', 'wanderer', 'demon_sect', 'became_bandit', 'has_master', 'demon_lord', 'sect_leader'] }",
  ],
  [
    "conditions: { forbidFlags: ['became_bandit'] }",
    "conditions: { forbidFlags: ['became_bandit', 'demon_sect', 'demon_lord', 'massacre', 'robber'] }",
  ],
  [
    "conditions: { forbidFlags: ['alliance_leader', 'sect_leader'] }",
    "conditions: { forbidFlags: ['alliance_leader', 'sect_leader', 'demon_sect', 'demon_lord', 'war_hero', 'pomo_path'] }",
  ],
  [
    "conditions: { forbidFlags: ['path_chosen', 'left_home', 'has_master', 'sect_outer', 'small_sect'] }",
    "conditions: { forbidFlags: ['path_chosen', 'left_home', 'has_master', 'sect_outer', 'small_sect', 'bandit_camp', 'became_bandit', 'demon_sect'] }",
  ],
]

for (const [a, b] of replacements) {
  if (!s.includes(a)) console.log('MISS:', a.slice(0, 60))
  else {
    s = s.replace(a, b)
    console.log('OK:', a.slice(0, 50))
  }
}

// mid_alliance forbidFlags
s = s.replace(
  /id: 'mid_alliance'[\s\S]*?conditions: \{([\s\S]*?)\},/,
  (block) => {
    if (block.includes("forbidFlags: ['demon_sect', 'massacre'")) {
      return block.replace(
        "forbidFlags: ['demon_sect', 'massacre']",
        "forbidFlags: ['demon_sect', 'massacre', 'robber', 'became_bandit', 'fugitive', 'demon_lord']",
      )
    }
    if (block.includes('forbidFlags:')) return block
    return block.replace(
      /conditions: \{/,
      "conditions: { forbidFlags: ['demon_sect', 'massacre', 'robber', 'became_bandit', 'fugitive', 'demon_lord'], ",
    )
  },
)

// Inject forbidFlags into specific events that lack conditions or need merge
function injectForbid(id, flags) {
  const marker = `id: '${id}'`
  const idx = s.indexOf(marker)
  if (idx < 0) {
    console.log('NO ID', id)
    return
  }
  const slice = s.slice(idx, idx + 800)
  if (slice.includes('forbidFlags:')) {
    console.log('HAS', id)
    return
  }
  if (slice.includes('conditions: {')) {
    s = s.slice(0, idx) + slice.replace('conditions: {', `conditions: { forbidFlags: ${flags}, `) + s.slice(idx + 800)
    console.log('INJECT', id)
  } else if (slice.includes('once: true,')) {
    s =
      s.slice(0, idx) +
      slice.replace('once: true,', `once: true,\n    conditions: { forbidFlags: ${flags} },`) +
      s.slice(idx + 800)
    console.log('ADD COND', id)
  } else if (slice.includes('needsChoice: true,')) {
    s =
      s.slice(0, idx) +
      slice.replace(
        'needsChoice: true,',
        `needsChoice: true,\n    conditions: { forbidFlags: ${flags} },`,
      ) +
      s.slice(idx + 800)
    console.log('ADD COND2', id)
  } else if (slice.includes('needsChoice: false,')) {
    s =
      s.slice(0, idx) +
      slice.replace(
        'needsChoice: false,',
        `needsChoice: false,\n    conditions: { forbidFlags: ${flags} },`,
      ) +
      s.slice(idx + 800)
    console.log('ADD COND3', id)
  } else {
    console.log('SKIP', id)
  }
}

const EVIL = "['demon_sect', 'demon_lord', 'massacre', 'became_bandit', 'robber']"
injectForbid('youth_arena', EVIL)
injectForbid('youth_merchant', "['became_bandit', 'robber', 'demon_lord']")
injectForbid('youth_sword_fame', "['demon_sect', 'demon_lord', 'massacre']")
injectForbid('gen_shaolin', EVIL)
injectForbid('gen_xianglong', EVIL)
injectForbid('gen_hengshan', EVIL)
injectForbid('mid_gaibang', EVIL)
injectForbid('gen_war', "['demon_sect', 'demon_lord', 'massacre']")
injectForbid('gen_court', EVIL)
injectForbid('child_bandit', "['path_chosen', 'has_master', 'sect_outer', 'small_sect']")
injectForbid('help_aftermath', "['demon_sect', 'robber']")

// Fix mid_massacre queue to bandit_finale
s = s.replace(
  `grantTitle: 'eguiman',
          attrs: { 心性: -25, 邪道威名: 25, 正道声望: -30 },
          addFlag: 'massacre',
          queueEvent: { id: 'mid_demon_throne', delayYears: 3 },`,
  `grantTitle: 'eguiman',
          attrs: { 心性: -25, 邪道威名: 25, 正道声望: -30 },
          addFlags: ['massacre', 'bandit_blood'],
          queueEvent: { id: 'bandit_finale', delayYears: 3 },`,
)

// mid_sect_fight 光明争夺 -> also queue sect_finale
s = s.replace(
  `grantTitle: 'zhangmen',
          attrs: { 正道声望: 20, 魅力: 5 },
          addFlag: 'sect_leader',
          queueEvent: { id: 'mid_alliance', delayYears: 4 },`,
  `grantTitle: 'zhangmen',
          attrs: { 正道声望: 20, 魅力: 5 },
          addFlag: 'sect_leader',
          queueEvents: [
            { id: 'mid_alliance', delayYears: 4 },
            { id: 'sect_finale', delayYears: 10 },
          ],`,
)

// love_marry queue love_finale
s = s.replace(
  `addFlag: 'married',
          removeFlag: 'lover_safe',
          queueEvent: { id: 'mid_student', delayYears: 8 },`,
  `addFlag: 'married',
          removeFlag: 'lover_safe',
          queueEvents: [
            { id: 'mid_student', delayYears: 8 },
            { id: 'love_finale', delayYears: 12 },
          ],`,
)

// love_after_save 结为道侣
s = s.replace(
  `addFlags: ['married', 'lover'],
          removeFlag: 'saved_lover',
          queueEvent: { id: 'gen_yunv', delayYears: 2 },`,
  `addFlags: ['married', 'lover'],
          removeFlag: 'saved_lover',
          queueEvents: [
            { id: 'gen_yunv', delayYears: 2 },
            { id: 'love_finale', delayYears: 10 },
          ],`,
)

fs.writeFileSync(path, s)
console.log('events patched')
