import type { EventDef } from '../types'

/** Phase 2：关系寻仇、门派包、传说词条专属链 */
export const PHASE2_EVENTS: EventDef[] = [
  {
    id: 'relation_revenge',
    name: '仇敌上门',
    text: '多年前结下的仇怨到期。刀光映在门环上，来人正是你名单上的那个名字。',
    stages: ['青年', '壮年', '晚年'],
    tags: ['仇敌', '战斗'],
    weight: 1,
    importance: 5,
    needsChoice: true,
    maxTimes: 3,
    cooldownYears: 6,
    conditions: { flags: ['enemy_due'] },
    choices: [
      {
        text: '正面迎战',
        effects: {
          removeFlag: 'enemy_due',
          combat: {
            foePower: 55,
            foeName: '仇敌',
            onWin: {
              attrs: { 武力: 4, 正道声望: 4 },
              setRelation: { kind: '仇敌', clear: true },
              logExtra: '仇怨已了，刀亦入鞘。',
            },
            onLose: {
              attrs: { 体魄: -8 },
              setRelation: { kind: '仇敌', bond: -60, revengeIn: 2 },
              logExtra: '你败了，但仇敌也未敢穷追。',
            },
            onDraw: {
              attrs: { 体魄: -6 },
              setRelation: { kind: '仇敌', revengeIn: 3 },
            },
          },
        },
        tendencyTags: ['冒险', '狠厉'],
      },
      {
        text: '请人调停',
        effects: {
          removeFlag: 'enemy_due',
          attrs: { 财富: -25, 魅力: 2 },
          setRelation: { kind: '仇敌', bond: -20, revengeIn: null, note: '暂且罢手' },
        },
        tendencyTags: ['谨慎', '交际'],
      },
      {
        text: '远走避锋',
        effects: {
          removeFlag: 'enemy_due',
          attrs: { 福缘: 2, 魅力: -3 },
          setRelation: { kind: '仇敌', revengeIn: 4 },
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },

  // —— 华山门派包 ——
  {
    id: 'huashan_assign',
    name: '华山记名',
    text: '大门派收你为记名弟子，引你上华山。剑气凛冽，师父说：华山剑宗，先立心，再立剑。',
    stages: ['少年', '青年'],
    tags: ['门派'],
    chain: 'sect',
    weight: 1,
    importance: 3,
    needsChoice: false,
    once: true,
    conditions: { flags: ['sect_outer', 'sect_huashan'] },
    choices: [
      {
        text: '恭敬受教',
        effects: {
          addMartialArt: 'huashan_jian',
          setRelation: { kind: '师父', bond: 50, note: '华山授业' },
          queueEvent: { id: 'huashan_sword_trial', delayYears: 3 },
        },
      },
    ],
  },
  {
    id: 'huashan_sword_trial',
    name: '华山剑试',
    text: '门中例行剑试。师兄持剑立于石坪，要你在三十招内分出高下。',
    stages: ['青年'],
    tags: ['门派', '战斗'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: { flags: ['sect_huashan'] },
    choices: [
      {
        text: '以剑对剑',
        effects: {
          combat: {
            foePower: 40,
            foeName: '华山师兄',
            onWin: {
              attrs: { 正道声望: 8, 武力: 4 },
              grantTitle: 'shaonian',
              queueEvent: { id: 'huashan_inner', delayYears: 4 },
            },
            onLose: {
              attrs: { 体魄: -5 },
              setRelation: { kind: '仇敌', name: '华山某师兄', bond: -35, revengeIn: 5 },
              addFlag: 'sect_enemy',
              queueEvent: { id: 'huashan_cliff_duel', delayYears: 3 },
            },
          },
        },
        tendencyTags: ['冒险', '修炼'],
      },
      {
        text: '请师父改试内功桩法',
        effects: {
          attrs: { 悟性: 3, 心性: 2 },
          upgradeMartialArt: 'any',
          addFlag: 'sect_loyal',
          queueEvent: { id: 'huashan_cliff_duel', delayYears: 4 },
        },
        tendencyTags: ['谨慎', '修炼'],
      },
    ],
  },
  {
    id: 'huashan_inner',
    name: '剑宗暗潮',
    text: '华山内里并非铁板一块。有人拉你入「剑气之争」，有人劝你两不相帮。',
    stages: ['青年', '壮年'],
    tags: ['门派'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: { flags: ['sect_huashan'], forbidFlags: ['left_sect'] },
    choices: [
      {
        text: '站队剑宗激进一侧',
        effects: {
          attrs: { 心性: -4, 武力: 5 },
          addFlag: 'huashan_radical',
          queueEvents: [
            { id: 'huashan_cliff_duel', delayYears: 2 },
            { id: 'mid_sect_fight', delayYears: 5 },
          ],
        },
        tendencyTags: ['冒险', '狠厉'],
      },
      {
        text: '两不相帮，潜心剑术',
        effects: {
          attrs: { 心性: 4, 悟性: 4 },
          addFlag: 'sect_loyal',
          queueEvents: [
            { id: 'huashan_cliff_duel', delayYears: 3 },
            { id: 'youth_sword_fame', delayYears: 4 },
          ],
        },
        tendencyTags: ['谨慎', '修炼'],
      },
    ],
  },

  // —— 丐帮包 ——
  {
    id: 'gaibang_oath',
    name: '丐帮香火',
    text: '你得降龙掌法后，丐帮长老以打狗棒残式相试，问你可愿守「忠义」二字。',
    stages: ['青年', '壮年'],
    tags: ['门派'],
    chain: 'sect',
    weight: 4,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      hasMartial: ['xianglong'],
      heartTiers: ['偏正', '至善', '中庸'],
      forbidFlags: ['demon_sect', 'became_bandit'],
    },
    choices: [
      {
        text: '对天起誓，入帮行走',
        effects: {
          addFlags: ['gaibang_member'],
          addMartialArt: 'dogbeating',
          setRelation: { kind: '挚友', name: '丐帮长老', bond: 55 },
          queueEvent: { id: 'gaibang_mission', delayYears: 3 },
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '只受掌法，不受帮规',
        effects: { attrs: { 福缘: 3, 正道声望: -2 }, addFlags: ['gaibang_member', 'gaibang_loose'], logExtra: '你学了掌法，却未真正入帮。' },
        tendencyTags: ['谨慎'],
      },
    ],
  },
  {
    id: 'gaibang_mission',
    name: '丐帮差遣',
    text: '帮中传来密信：某州府有恶霸欺压贫民。要你带一路分舵弟子前去。',
    stages: ['壮年', '青年'],
    tags: ['门派', '正道', '战斗'],
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: { flags: ['gaibang_member'] },
    choices: [
      {
        text: '率众除霸',
        effects: {
          combat: {
            foePower: 48,
            foeName: '恶霸打手',
            onWin: {
              attrs: { 心性: 8, 正道声望: 12 },
              addFlag: 'helped_people',
              queueEvent: { id: 'gaibang_info_net', delayYears: 2 },
            },
            onLose: {
              attrs: { 体魄: -10 },
              setRelation: { kind: '仇敌', name: '恶霸', bond: -50, revengeIn: 3 },
              queueEvent: { id: 'gaibang_internal', delayYears: 2 },
            },
          },
        },
        tendencyTags: ['侠义', '冒险'],
      },
      {
        text: '智取证据交官',
        effects: {
          attrs: { 心性: 5, 正道声望: 8, 财富: -5 },
          addFlag: 'helped_people',
          queueEvent: { id: 'gaibang_info_net', delayYears: 3 },
        },
        tendencyTags: ['谨慎', '侠义'],
      },
    ],
  },

  // —— 传说词条：魔种 ——
  {
    id: 'trait_mozhong_dream',
    name: '魔种夜呓',
    text: '你血脉中的魔种在夜半低语，教你一套吸人内力的残法。耳边像有人笑：越狠，越强。',
    stages: ['少年', '青年'],
    tags: ['魔教', '武学'],
    chain: 'demon',
    weight: 6,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: { traits: ['mozhong'] },
    choices: [
      {
        text: '照着修炼',
        effects: {
          addMartialArt: 'xixing',
          attrs: { 心性: -15, 武力: 10 },
          addFlags: ['demon_power', 'mozhong_path'],
          queueEvents: [
            { id: 'trait_mozhong_hunt', delayYears: 4 },
            { id: 'trait_mozhong_echo', delayYears: 25 },
          ],
        },
        tendencyTags: ['狠厉', '贪婪'],
      },
      {
        text: '以正功强行镇压',
        effects: {
          attrs: { 心性: 8, 体魄: -6 },
          addFlag: 'mozhong_suppressed',
          queueEvents: [
            { id: 'teen_join_sect', delayYears: 2 },
            { id: 'trait_mozhong_echo', delayYears: 28 },
          ],
        },
        tendencyTags: ['侠义', '谨慎'],
      },
    ],
  },
  {
    id: 'trait_mozhong_hunt',
    name: '正道追查',
    text: '有正道剑客循着「吸星」异动找上门，指责你为魔种余孽。',
    stages: ['青年', '壮年'],
    tags: ['正邪', '战斗'],
    chain: 'demon',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: { flags: ['mozhong_path'] },
    choices: [
      {
        text: '硬拼',
        effects: {
          combat: {
            foePower: 52,
            foeName: '正道剑客',
            onWin: {
              attrs: { 邪道威名: 12, 心性: -8 },
              setRelation: { kind: '仇敌', name: '正道追杀者', bond: -55, revengeIn: 4 },
              queueEvent: { id: 'youth_demon_invite', delayYears: 2 },
            },
            onLose: { attrs: { 体魄: -14 }, addFlag: 'fugitive' },
          },
        },
        tendencyTags: ['狠厉', '冒险'],
      },
      {
        text: '逃入魔教寻求庇护',
        effects: {
          addFlags: ['demon_sect', 'fugitive'],
          attrs: { 心性: -10 },
          queueEvent: { id: 'demon_task', delayYears: 2 },
        },
        tendencyTags: ['贪婪'],
      },
    ],
  },

  // —— 传说词条：医仙 ——
  {
    id: 'trait_yixian_clinic',
    name: '悬壶初试',
    text: '村中瘟疫将起。你医仙转世的直觉告诉你：若现在出手，可救一村，却也可能把自己拖垮。',
    stages: ['少年', '青年'],
    tags: ['医术', '称号'],
    weight: 5,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: { traits: ['yixian'] },
    choices: [
      {
        text: '日夜施医',
        effects: {
          addMartialArt: 'medicine',
          addFlags: ['doctor', 'yixian_path'],
          attrs: { 心性: 10, 体魄: -6, 正道声望: 10 },
          setRelation: { kind: '挚友', name: '村中老丈', bond: 60 },
          queueEvents: [
            { id: 'youth_save_plague', delayYears: 5 },
            { id: 'trait_yixian_echo', delayYears: 22 },
          ],
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '先自保学艺，日后再救',
        effects: {
          addMartialArt: 'medicine',
          addFlags: ['doctor', 'yixian_path'],
          attrs: { 悟性: 4 },
          queueEvent: { id: 'trait_yixian_echo', delayYears: 24 },
        },
        tendencyTags: ['谨慎', '修炼'],
      },
    ],
  },

  // —— 传说/史诗词条：剑骨 ——
  {
    id: 'trait_jiangu_dream',
    name: '剑骨共鸣',
    text: '你路过废剑冢，残剑齐鸣。剑骨天成的血脉像被点燃——有一把无锋之剑，在呼唤你。',
    stages: ['青年'],
    tags: ['奇遇', '武学'],
    weight: 5,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: { traits: ['jiangu'], forbidFlags: ['cliff_sword'] },
    choices: [
      {
        text: '拔剑问道',
        effects: {
          addMartialArt: 'dugu',
          setRealm: '先天',
          attrs: { 悟性: 5, 体魄: -5 },
          addFlags: ['cliff_sword', 'jiangu_path'],
          setRelation: { kind: '师父', name: '剑冢残意', bond: 30, note: '以剑为师' },
          queueEvents: [
            { id: 'youth_sword_fame', delayYears: 2 },
            { id: 'trait_jiangu_echo', delayYears: 20 },
          ],
        },
        tendencyTags: ['修炼', '冒险'],
      },
      {
        text: '不敢妄动，仅观剑意',
        effects: {
          addMartialArt: 'huashan_jian',
          attrs: { 悟性: 4, 福缘: 3 },
          addFlag: 'jiangu_path',
          queueEvent: { id: 'trait_jiangu_echo', delayYears: 22 },
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },
]
