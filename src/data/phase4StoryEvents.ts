import type { EventDef } from '../types'

/**
 * Phase 4：故事零件——补门派中段/终局、主线断链、词条后半生回响。
 * 原则：每个 needsChoice 必须改 flag / 队列 / 称号 / 关系 / 战斗分支。
 */
export const PHASE4_STORY_EVENTS: EventDef[] = [
  // ═══════════════════════════════════════
  // 华山：中段劫 + 终局
  // ═══════════════════════════════════════
  {
    id: 'huashan_cliff_duel',
    name: '思过崖约战',
    text: '有外门剑客指名要在思过崖与你比剑，赌的是华山颜面。师父说：可拒，亦可应——应则生死自负。',
    stages: ['青年', '壮年'],
    tags: ['门派', '战斗'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['sect_huashan'],
      anyFlags: ['sect_loyal', 'huashan_radical', 'sword_fame', 'sect_enemy'],
      forbidFlags: ['left_sect', 'massacre', 'demon_lord'],
    },
    choices: [
      {
        text: '应战，守华山剑名',
        effects: {
          combat: {
            foePower: 50,
            foeName: '外门剑客',
            onWin: {
              attrs: { 正道声望: 10, 武力: 4 },
              addFlag: 'huashan_cliff_win',
              setRelation: { kind: '仇敌', name: '外门剑客', bond: -40, revengeIn: 4 },
              queueEvent: { id: 'huashan_demon_raid', delayYears: 3 },
            },
            onLose: {
              attrs: { 体魄: -10 },
              addFlag: 'huashan_cliff_lose',
              queueEvent: { id: 'huashan_finale', delayYears: 2 },
            },
          },
        },
        tendencyTags: ['冒险', '侠义'],
      },
      {
        text: '拒战，以门规挡之',
        effects: {
          attrs: { 心性: 3, 魅力: -2 },
          addFlag: 'huashan_refused_duel',
          setRelation: { kind: '挚友', name: '掌门代言长老', bond: 35 },
          queueEvent: { id: 'huashan_demon_raid', delayYears: 4 },
        },
        tendencyTags: ['谨慎', '修炼'],
      },
      {
        text: '私下去了结，不惊动山门',
        effects: {
          attrs: { 心性: -4, 武力: 3 },
          addFlags: ['huashan_shadow_duel', 'sect_enemy'],
          setRelation: { kind: '仇敌', name: '外门剑客', bond: -55, revengeIn: 2 },
          queueEvents: [
            { id: 'relation_revenge', delayYears: 2 },
            { id: 'huashan_demon_raid', delayYears: 5 },
          ],
        },
        tendencyTags: ['狠厉', '谨慎'],
      },
    ],
  },
  {
    id: 'huashan_demon_raid',
    name: '魔教犯华山',
    text: '魔教夜袭华山侧峰，火光映剑。掌门问你：守山门，还是追敌入谷？',
    stages: ['壮年', '青年'],
    tags: ['门派', '魔教', '战斗'],
    chain: 'sect',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['sect_huashan'],
      forbidFlags: ['left_sect', 'demon_sect', 'massacre'],
    },
    choices: [
      {
        text: '死守山门',
        effects: {
          combat: {
            foePower: 55,
            foeName: '魔教夜袭队',
            onWin: {
              attrs: { 正道声望: 12, 心性: 6 },
              addFlags: ['huashan_defended', 'pomo_path', 'helped_people'],
              queueEvent: { id: 'huashan_finale', delayYears: 4 },
            },
            onLose: {
              attrs: { 体魄: -12 },
              addFlag: 'huashan_scar',
              queueEvent: { id: 'huashan_finale', delayYears: 3 },
            },
          },
        },
        tendencyTags: ['侠义', '冒险'],
      },
      {
        text: '率精锐追入谷中',
        effects: {
          combat: {
            foePower: 58,
            foeName: '魔教护法',
            onWin: {
              attrs: { 武力: 6, 邪道威名: 4 },
              addFlags: ['huashan_pursuit', 'pomo_path'],
              grantTitle: 'pomo',
              queueEvent: { id: 'huashan_finale', delayYears: 3 },
            },
            onLose: {
              attrs: { 体魄: -14 },
              addFlags: ['fugitive', 'huashan_scar'],
              queueEvent: { id: 'demon_retaliate', delayYears: 2 },
            },
          },
        },
        tendencyTags: ['冒险', '狠厉'],
      },
      {
        text: '借机离山，从此散修',
        effects: {
          addFlag: 'sect_leave_pending',
          queueEvent: { id: 'huashan_finale', delayYears: 1 },
          logExtra: '掌门准你暂离，却说：走前须把华山一脉的去向想清楚。',
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },
  {
    id: 'huashan_finale',
    name: '华山余剑',
    text: '华山一脉走到分岔口。有人推你做掌门，有人劝你带着剑意下山，还有人说：留下剑谱，人可以走。',
    stages: ['青年', '壮年', '晚年'],
    tags: ['门派', '结局'],
    chain: 'sect',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    minAge: 28,
    conditions: {
      flags: ['sect_huashan'],
      anyFlags: [
        'huashan_defended',
        'huashan_pursuit',
        'huashan_cliff_win',
        'huashan_cliff_lose',
        'huashan_scar',
        'huashan_radical',
        'sect_loyal',
        'huashan_refused_duel',
        'huashan_shadow_duel',
        'sect_leave_pending',
      ],
      forbidFlags: ['left_sect', 'huashan_finale_done'],
    },
    choices: [
      {
        text: '接掌华山',
        effects: {
          grantTitle: 'zhangmen',
          addFlags: ['sect_leader', 'sect_finale', 'huashan_finale_done'],
          attrs: { 正道声望: 15 },
          setRelation: { kind: '徒弟', bond: 40, note: '华山新一辈' },
          queueEvent: { id: 'old_pass_art', delayYears: 5 },
        },
        tendencyTags: ['侠义', '交际'],
      },
      {
        text: '传剑下山，不问门务',
        effects: {
          addFlags: ['sect_finale', 'huashan_finale_done', 'wanderer', 'left_sect'],
          removeFlags: ['sect_outer', 'sect_huashan', 'sect_loyal', 'sect_leave_pending'],
          grantTitle: 'junzijian',
          attrs: { 心性: 5 },
          queueEvent: { id: 'youth_sword_fame', delayYears: 2 },
        },
        tendencyTags: ['修炼', '谨慎'],
      },
      {
        text: '闭关思过崖，余生只对剑',
        effects: {
          addFlags: ['sect_finale', 'huashan_finale_done', 'retreated'],
          removeFlag: 'sect_leave_pending',
          grantTitle: 'yinshi',
          setRealm: '宗师',
          queueEvent: { id: 'mid_closedoor', delayYears: 3 },
        },
        tendencyTags: ['修炼'],
      },
    ],
  },

  // ═══════════════════════════════════════
  // 丐帮：中段 + 终局
  // ═══════════════════════════════════════
  {
    id: 'gaibang_info_net',
    name: '丐帮眼线',
    text: '帮中长老把一张残图塞给你：东南某城有官商勾结，贫民断粮。要你带分舵弟子查实，可杀可留。',
    stages: ['青年', '壮年'],
    tags: ['门派', '正道'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['gaibang_member'],
      forbidFlags: ['demon_sect', 'massacre', 'became_bandit'],
    },
    choices: [
      {
        text: '查实后公之于众',
        effects: {
          attrs: { 心性: 6, 正道声望: 10 },
          addFlags: ['helped_people', 'gaibang_exposed'],
          setRelation: { kind: '仇敌', name: '贪官幕僚', bond: -45, revengeIn: 3 },
          queueEvent: { id: 'gaibang_dogstick_trial', delayYears: 3 },
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '夜袭粮仓，先救人',
        effects: {
          combat: {
            foePower: 46,
            foeName: '官商护卫',
            onWin: {
              attrs: { 心性: 8, 正道声望: 8, 财富: -10 },
              addFlags: ['helped_people', 'gaibang_raid'],
              queueEvent: { id: 'gaibang_dogstick_trial', delayYears: 2 },
            },
            onLose: {
              attrs: { 体魄: -10 },
              addFlag: 'fugitive',
              queueEvent: { id: 'gaibang_internal', delayYears: 2 },
            },
          },
        },
        tendencyTags: ['冒险', '侠义'],
      },
      {
        text: '收贿装作未见',
        effects: {
          attrs: { 心性: -12, 财富: 40 },
          addFlags: ['gaibang_corrupt', 'ignored_injustice'],
          queueEvent: { id: 'gaibang_internal', delayYears: 2 },
        },
        tendencyTags: ['贪婪', '谨慎'],
      },
    ],
  },
  {
    id: 'gaibang_dogstick_trial',
    name: '打狗棒试',
    text: '帮主之位悬空已久。长老以打狗棒残式试你：能接三十招，便有资格议「忠义」。',
    stages: ['青年', '壮年'],
    tags: ['门派', '战斗'],
    chain: 'sect',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['gaibang_member'],
      anyFlags: ['gaibang_exposed', 'gaibang_raid', 'helped_people', 'gaibang_heir', 'sect_loyal'],
      forbidFlags: ['gaibang_corrupt', 'massacre'],
    },
    choices: [
      {
        text: '硬接三十招',
        effects: {
          combat: {
            foePower: 52,
            foeName: '丐帮长老',
            onWin: {
              addMartialArt: 'dogbeating',
              addFlag: 'gaibang_heir',
              setRelation: { kind: '师父', name: '丐帮长老', bond: 70 },
              queueEvent: { id: 'mid_gaibang', delayYears: 2 },
            },
            onLose: {
              attrs: { 体魄: -8 },
              addFlag: 'gaibang_failed_trial',
              queueEvent: { id: 'gaibang_finale', delayYears: 4 },
            },
          },
        },
        tendencyTags: ['冒险', '修炼'],
      },
      {
        text: '以智破式，不硬拼',
        effects: {
          attrs: { 悟性: 5, 正道声望: 6 },
          addMartialArt: 'dogbeating',
          addFlag: 'gaibang_heir',
          queueEvent: { id: 'mid_gaibang', delayYears: 3 },
        },
        tendencyTags: ['谨慎', '修炼'],
      },
    ],
  },
  {
    id: 'gaibang_internal',
    name: '帮内裂隙',
    text: '丐帮内部分舵开始互咬。有人要你站队夺权，有人要你清扫门户，有人劝你带一袋金银远走。',
    stages: ['壮年'],
    tags: ['门派'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['gaibang_member'],
      anyFlags: ['gaibang_corrupt', 'fugitive', 'gaibang_failed_trial'],
    },
    choices: [
      {
        text: '清扫门户，重立帮规',
        effects: {
          attrs: { 心性: 5, 正道声望: 8 },
          removeFlag: 'gaibang_corrupt',
          addFlags: ['gaibang_reformed', 'helped_people'],
          queueEvent: { id: 'gaibang_finale', delayYears: 3 },
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '夺权称霸',
        effects: {
          attrs: { 心性: -8, 邪道威名: 10 },
          addFlags: ['gaibang_tyrant'],
          grantTitle: 'gaibang',
          queueEvent: { id: 'gaibang_finale', delayYears: 2 },
        },
        tendencyTags: ['狠厉', '贪婪'],
      },
      {
        text: '带弟子远走，另立山头',
        effects: {
          removeFlag: 'gaibang_member',
          addFlags: ['left_sect', 'wanderer', 'has_student'],
          setRelation: { kind: '徒弟', bond: 55 },
          grantTitle: 'duxing',
          queueEvent: { id: 'mid_student', delayYears: 3 },
        },
        tendencyTags: ['谨慎', '冒险'],
      },
    ],
  },
  {
    id: 'gaibang_finale',
    name: '丐帮终章',
    text: '天下叫花子的眼睛都看着你。棒在不在你手里，帮还在不在「忠义」二字上，就看这一步。',
    stages: ['青年', '壮年', '晚年'],
    tags: ['门派', '结局'],
    chain: 'sect',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    minAge: 28,
    conditions: {
      anyFlags: [
        'gaibang_member',
        'gaibang_heir',
        'gaibang_reformed',
        'gaibang_tyrant',
        'gaibang_failed_trial',
      ],
      forbidFlags: ['gaibang_finale_done', 'demon_lord'],
    },
    choices: [
      {
        text: '正位帮主，开仓赈济',
        effects: {
          grantTitle: 'gaibang',
          addFlags: ['sect_finale', 'gaibang_finale_done', 'helped_people'],
          attrs: { 正道声望: 18, 财富: -30, 心性: 8 },
          queueEvent: { id: 'mid_alliance', delayYears: 4 },
        },
        tendencyTags: ['侠义', '交际'],
      },
      {
        text: '让位隐退，棒法传人',
        effects: {
          addMartialArt: 'dogbeating',
          addFlags: ['sect_finale', 'gaibang_finale_done', 'retreated'],
          grantTitle: 'yinshi',
          setRelation: { kind: '徒弟', bond: 65, note: '打狗棒传人' },
          queueEvent: { id: 'old_pass_art', delayYears: 3 },
        },
        tendencyTags: ['谨慎', '修炼'],
      },
      {
        text: '以棒入魔，吞并分舵',
        effects: {
          attrs: { 心性: -15, 邪道威名: 20 },
          addFlags: ['gaibang_finale_done', 'demon_sect'],
          grantTitle: 'mozhang',
          queueEvent: { id: 'demon_task', delayYears: 2 },
        },
        tendencyTags: ['狠厉', '贪婪'],
      },
    ],
  },

  // ═══════════════════════════════════════
  // 武当 / 少林 / 峨眉：独有中段劫补强
  // ═══════════════════════════════════════
  {
    id: 'wudang_true_martial_letter',
    name: '真武密笺',
    text: '山门收到一封无署名密笺：有人要以「真武剑」换你的师门秘传。道长说：可查、可拒，不可卖。',
    stages: ['壮年', '青年'],
    tags: ['门派'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['sect_wudang'],
      forbidFlags: ['left_sect', 'stole_book', 'massacre'],
    },
    choices: [
      {
        text: '赴约查清来人',
        effects: {
          combat: {
            foePower: 50,
            foeName: '假道士',
            onWin: {
              attrs: { 正道声望: 8 },
              addFlags: ['wudang_letter_cleared', 'pomo_path'],
              queueEvent: { id: 'wudang_demon_siege', delayYears: 3 },
            },
            onLose: {
              attrs: { 体魄: -8 },
              addFlag: 'wudang_letter_scar',
              queueEvent: { id: 'wudang_finale', delayYears: 5 },
            },
          },
        },
        tendencyTags: ['冒险', '侠义'],
      },
      {
        text: '拒笺，加强山门戒备',
        effects: {
          attrs: { 心性: 4 },
          addFlag: 'wudang_vigilant',
          setRelation: { kind: '挚友', name: '护山道童', bond: 45 },
          queueEvent: { id: 'wudang_demon_siege', delayYears: 2 },
        },
        tendencyTags: ['谨慎'],
      },
      {
        text: '假意应承，调包秘籍',
        effects: {
          attrs: { 心性: -6, 悟性: 3 },
          addFlags: ['wudang_decoy', 'stole_book'],
          queueEvent: { id: 'steal_exposed', delayYears: 4 },
        },
        tendencyTags: ['狠厉', '谨慎'],
      },
    ],
  },
  {
    id: 'shaolin_injured_echo',
    name: '木人巷旧伤',
    text: '木人巷留下的暗伤年年作祟。有僧人劝你散功保命，有人说可借伤入更深禅武。',
    stages: ['壮年', '晚年'],
    tags: ['门派'],
    chain: 'sect',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['sect_shaolin'],
      anyFlags: ['shaolin_injured', 'shaolin_wooden_fail'],
      forbidFlags: ['left_sect'],
    },
    choices: [
      {
        text: '散去一部分外功，保命修道',
        effects: {
          demoteRealm: '后天',
          attrs: { 体魄: 10, 心性: 6 },
          addFlags: ['shaolin_healed', 'retreated'],
          grantTitle: 'yinshi',
          queueEvent: { id: 'shaolin_finale', delayYears: 3 },
        },
        tendencyTags: ['谨慎', '修炼'],
      },
      {
        text: '以伤入禅，强行突破',
        effects: {
          setRealm: '宗师',
          attrs: { 体魄: -12, 悟性: 6 },
          addFlag: 'shaolin_zen_break',
          queueEvent: { id: 'shaolin_sect_war', delayYears: 2 },
        },
        tendencyTags: ['冒险', '修炼'],
      },
      {
        text: '还俗求医，从此不问寺务',
        effects: {
          removeFlags: ['sect_shaolin', 'sect_outer'],
          addFlags: ['left_sect', 'doctor', 'wanderer'],
          addMartialArt: 'medicine',
          queueEvent: { id: 'trait_yixian_clinic', delayYears: 2 },
        },
        tendencyTags: ['谨慎', '侠义'],
      },
    ],
  },
  {
    id: 'emei_poison_echo',
    name: '清音阁余毒',
    text: '当年毒茶案未了。旧人携解药与毒药同至，要你在「救一人」与「绝一脉」之间抉择。',
    stages: ['壮年', '晚年'],
    tags: ['门派', '毒'],
    chain: 'sect',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['sect_emei'],
      anyFlags: ['emei_poison_seen', 'poisoned_once', 'emei_justice', 'poison_grudge'],
      forbidFlags: ['left_sect', 'massacre'],
    },
    choices: [
      {
        text: '救人，公开药方',
        effects: {
          attrs: { 心性: 10, 正道声望: 12 },
          addFlags: ['emei_poison_cleared', 'helped_people', 'doctor'],
          grantTitle: 'yixian',
          queueEvent: { id: 'emei_finale', delayYears: 3 },
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '留毒为刃，震慑宵小',
        effects: {
          attrs: { 心性: -8, 邪道威名: 10 },
          addMartialArt: 'poison',
          addFlags: ['emei_poison_kept'],
          setRelation: { kind: '仇敌', name: '毒案余党', bond: -50, revengeIn: 3 },
          queueEvent: { id: 'emei_finale', delayYears: 2 },
        },
        tendencyTags: ['狠厉', '谨慎'],
      },
      {
        text: '双焚解药与毒药，断因果',
        effects: {
          attrs: { 心性: 4, 福缘: 4 },
          addFlags: ['emei_poison_burned', 'sect_finale'],
          grantTitle: 'yinshi',
          queueEvent: { id: 'emei_finale', delayYears: 2 },
        },
        tendencyTags: ['修炼', '谨慎'],
      },
    ],
  },

  // ═══════════════════════════════════════
  // 词条后半生回响
  // ═══════════════════════════════════════
  {
    id: 'trait_mozhong_echo',
    name: '魔种暮鼓',
    text: '晚年夜里，血脉里的魔种又响。有人说你可借此再起，有人说你该把自己封死在禅室。',
    stages: ['晚年', '壮年'],
    tags: ['魔教'],
    chain: 'demon',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    minAge: 45,
    conditions: {
      traits: ['mozhong'],
      anyFlags: ['mozhong_path', 'mozhong_suppressed', 'demon_power'],
      forbidFlags: ['mozhong_echo_done'],
    },
    choices: [
      {
        text: '释放魔种，再入江湖',
        effects: {
          attrs: { 心性: -12, 武力: 10 },
          addFlags: ['mozhong_echo_done', 'demon_sect', 'mozhong_path'],
          addMartialArt: 'xixing',
          queueEvent: { id: 'mid_demon_throne', delayYears: 2 },
        },
        tendencyTags: ['狠厉', '贪婪'],
      },
      {
        text: '彻底封死，余生做普通人',
        effects: {
          attrs: { 心性: 10, 体魄: -6 },
          addFlags: ['mozhong_echo_done', 'mozhong_suppressed', 'retreated'],
          grantTitle: 'yinshi',
          queueEvent: { id: 'old_retreat', delayYears: 2 },
        },
        tendencyTags: ['谨慎', '侠义'],
      },
      {
        text: '把秘密传给唯一弟子',
        effects: {
          addFlags: ['mozhong_echo_done', 'has_student'],
          setRelation: { kind: '徒弟', bond: 50, note: '知魔种之秘' },
          queueEvent: { id: 'mid_student', delayYears: 1 },
        },
        tendencyTags: ['交际', '谨慎'],
      },
    ],
  },
  {
    id: 'trait_yixian_echo',
    name: '医仙夜诊',
    text: '大疫又起。有人跪求「慈悲医仙」出山，有人警告：再救一次，你会把自己救空。',
    stages: ['晚年', '壮年'],
    tags: ['医术', '正道'],
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    minAge: 40,
    conditions: {
      traits: ['yixian'],
      anyFlags: ['yixian_path', 'doctor', 'saved_plague'],
      forbidFlags: ['yixian_echo_done', 'massacre'],
    },
    choices: [
      {
        text: '再救一城',
        effects: {
          attrs: { 心性: 12, 体魄: -14, 正道声望: 20 },
          addFlags: ['yixian_echo_done', 'saved_plague', 'helped_people'],
          grantTitle: 'jiushi',
          queueEvent: { id: 'justice_epilogue', delayYears: 3 },
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '传医不传命，广收学徒',
        effects: {
          addFlags: ['yixian_echo_done', 'has_student'],
          setRelation: { kind: '徒弟', bond: 70, note: '医术传人' },
          grantTitle: 'yixian',
          queueEvent: { id: 'old_pass_art', delayYears: 2 },
        },
        tendencyTags: ['修炼', '侠义'],
      },
      {
        text: '拒诊保命，闭门写书',
        effects: {
          attrs: { 悟性: 6, 魅力: -4 },
          addFlags: ['yixian_echo_done', 'retreated'],
          grantTitle: 'yinshi',
          queueEvent: { id: 'old_retreat', delayYears: 2 },
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },
  {
    id: 'trait_jiangu_echo',
    name: '剑骨终鸣',
    text: '剑骨共鸣到了尽头。一把无锋旧剑在夜里震响——你可把它传下去，也可把它折断，免得后人再为剑所累。',
    stages: ['晚年', '壮年'],
    tags: ['武学', '剑'],
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    minAge: 42,
    conditions: {
      traits: ['jiangu'],
      anyFlags: ['jiangu_path', 'cliff_sword', 'sword_fame'],
      forbidFlags: ['jiangu_echo_done'],
    },
    choices: [
      {
        text: '传剑于有缘人',
        effects: {
          addFlags: ['jiangu_echo_done', 'has_student'],
          setRelation: { kind: '徒弟', bond: 60, note: '剑骨传人' },
          grantTitle: 'junzijian',
          queueEvent: { id: 'old_pass_art', delayYears: 2 },
        },
        tendencyTags: ['侠义', '修炼'],
      },
      {
        text: '折剑归隐',
        effects: {
          addFlags: ['jiangu_echo_done', 'retreated'],
          grantTitle: 'yinshi',
          attrs: { 心性: 6 },
          queueEvent: { id: 'old_retreat', delayYears: 2 },
        },
        tendencyTags: ['谨慎'],
      },
      {
        text: '以剑入魔，求更高剑意',
        effects: {
          attrs: { 心性: -10, 武力: 8 },
          addFlags: ['jiangu_echo_done', 'demon_power'],
          grantTitle: 'jianmo',
          addMartialArt: 'kuihua',
          queueEvent: { id: 'old_final_battle', delayYears: 3 },
        },
        tendencyTags: ['狠厉', '修炼'],
      },
    ],
  },

  // ═══════════════════════════════════════
  // 主线断链修补：情缘 / 匪患 / 正道 / 魔教
  // ═══════════════════════════════════════
  {
    id: 'love_revenge_settle',
    name: '情仇落定',
    text: '仇报了，或未报完。你站在故人坟前，必须决定余生是继续走江湖，还是把情缘写成句号。',
    stages: ['壮年', '晚年'],
    tags: ['情缘'],
    chain: 'love',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      anyFlags: ['love_revenge_done', 'avenged_love', 'lost_lover'],
      forbidFlags: ['love_finale', 'love_revenge_settled'],
    },
    choices: [
      {
        text: '为她/他立碑，余生独行',
        effects: {
          addFlags: ['love_revenge_settled', 'retreated'],
          grantTitle: 'qingcheng',
          setRelation: { kind: '道侣', clear: true },
          queueEvents: [
            { id: 'love_finale', delayYears: 2 },
            { id: 'old_retreat', delayYears: 5 },
          ],
        },
        tendencyTags: ['谨慎'],
      },
      {
        text: '把余情化作行侠',
        effects: {
          attrs: { 心性: 8, 正道声望: 10 },
          addFlags: ['love_revenge_settled', 'helped_people'],
          grantTitle: 'xiake',
          queueEvents: [
            { id: 'love_finale', delayYears: 2 },
            { id: 'mid_alliance', delayYears: 4 },
          ],
          logExtra: '旧日刀名渐淡，世人改称你一声义士。',
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '再寻新缘，不叫旧债绑死',
        effects: {
          addFlags: ['love_revenge_settled', 'lover'],
          removeFlag: 'lost_lover',
          setRelation: { kind: '道侣', bond: 40, note: '晚景新缘' },
          queueEvent: { id: 'love_finale', delayYears: 5 },
        },
        tendencyTags: ['交际', '冒险'],
      },
    ],
  },
  {
    id: 'ignored_injustice_echo',
    name: '旧日冷眼',
    text: '多年前你对不公视而不见。受害者的后人找上门，捧着旧物问：当年你为何袖手？',
    stages: ['壮年', '晚年'],
    tags: ['正道'],
    chain: 'justice',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    minAge: 35,
    conditions: {
      flags: ['ignored_injustice'],
      forbidFlags: ['injustice_echo_done', 'massacre'],
    },
    choices: [
      {
        text: '补偿，并当众认错',
        effects: {
          attrs: { 心性: 10, 财富: -20, 正道声望: 8 },
          addFlags: ['injustice_echo_done', 'helped_people'],
          removeFlag: 'ignored_injustice',
          queueEvent: { id: 'help_aftermath', delayYears: 2 },
        },
        tendencyTags: ['侠义'],
      },
      {
        text: '冷拒，称江湖本无公道',
        effects: {
          attrs: { 心性: -8, 魅力: -5 },
          addFlags: ['injustice_echo_done'],
          setRelation: { kind: '仇敌', name: '旧案后人', bond: -50, revengeIn: 3 },
        },
        tendencyTags: ['狠厉', '谨慎'],
      },
      {
        text: '暗中补救，不留名',
        effects: {
          attrs: { 心性: 6, 财富: -15 },
          addFlags: ['injustice_echo_done', 'helped_people'],
          removeFlag: 'ignored_injustice',
          grantTitle: 'xiake',
          queueEvent: { id: 'wanderer_road_justice', delayYears: 3 },
        },
        tendencyTags: ['谨慎', '侠义'],
      },
    ],
  },
  {
    id: 'demon_fugitive_echo',
    name: '亡命途中',
    text: '你仍在逃。正道悬赏、魔教追讨。客栈里有人递刀，有人递度牒，有人递一封「归来便饶你」的魔教手令。',
    stages: ['壮年', '青年'],
    tags: ['魔教'],
    chain: 'demon',
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      anyFlags: ['fugitive', 'demon_soft'],
      forbidFlags: ['demon_lord', 'fugitive_echo_done', 'alliance_leader'],
    },
    choices: [
      {
        text: '投正道自证',
        effects: {
          attrs: { 心性: 8 },
          addFlags: ['fugitive_echo_done', 'pomo_path'],
          removeFlag: 'fugitive',
          grantTitle: 'pomo',
          queueEvent: { id: 'mid_alliance', delayYears: 3 },
        },
        tendencyTags: ['侠义', '谨慎'],
      },
      {
        text: '持令归魔',
        effects: {
          attrs: { 心性: -10 },
          addFlags: ['fugitive_echo_done', 'demon_sect', 'demon_loyal'],
          removeFlag: 'fugitive',
          queueEvent: { id: 'mid_demon_throne', delayYears: 2 },
        },
        tendencyTags: ['狠厉'],
      },
      {
        text: '隐姓埋名，永不露面',
        effects: {
          addFlags: ['fugitive_echo_done', 'retreated', 'wanderer'],
          removeFlag: 'fugitive',
          grantTitle: 'yinshi',
          queueEvent: { id: 'old_retreat', delayYears: 2 },
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },

  // ═══════════════════════════════════════
  // 商途 / 朝廷：跨分支独有劫
  // ═══════════════════════════════════════
  {
    id: 'merchant_ledger_crisis',
    name: '假账风波',
    text: '账房先生暴毙，匣中假账曝光。同行要吞你，官府要查你，江湖闲人等着看你落水。商途走到这一步，必须选边。',
    stages: ['青年', '壮年'],
    tags: ['商途', '灾祸'],
    chain: 'merchant',
    weight: 3,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['merchant_path'],
      forbidFlags: ['merchant_crisis_done', 'massacre'],
    },
    choices: [
      {
        text: '散财自清，公开账册',
        effects: {
          attrs: { 财富: -40, 心性: 8, 正道声望: 10 },
          addFlags: ['merchant_crisis_done', 'merchant_honest', 'helped_people'],
          grantTitle: 'xiake',
          queueEvent: { id: 'merchant_finale', delayYears: 8 },
        },
        tendencyTags: ['侠义', '谨慎'],
      },
      {
        text: '买通官府，压下风波',
        effects: {
          attrs: { 财富: -25, 心性: -6, 魅力: 3 },
          addFlags: ['merchant_crisis_done', 'merchant_bribe', 'official'],
          setRelation: { kind: '仇敌', name: '揭账同行', bond: -45, revengeIn: 4 },
          queueEvent: { id: 'merchant_corrupt_official', delayYears: 3 },
        },
        tendencyTags: ['贪婪', '交际'],
      },
      {
        text: '反咬一口，雇刀灭口',
        effects: {
          attrs: { 心性: -12, 邪道威名: 10 },
          addFlags: ['merchant_crisis_done', 'merchant_assassin', 'merchant_dark_deal', 'fugitive'],
          grantTitle: 'sharen',
          setRelation: { kind: '仇敌', name: '查账钦差线人', bond: -60, revengeIn: 3 },
          queueEvent: { id: 'merchant_assassination', delayYears: 2 },
        },
        tendencyTags: ['狠厉', '贪婪'],
      },
    ],
  },
  {
    id: 'court_secret_edict',
    name: '密诏夜至',
    text: '夜半一道密诏：或查办权贵，或监视江湖盟主，或诬一桩旧案。拒则失宠，从则脏了手——庙堂独有的劫，躲不过。',
    stages: ['青年', '壮年'],
    tags: ['朝廷', '灾祸'],
    chain: 'court',
    weight: 3,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      anyFlags: ['official', 'army', 'court_aspirant', 'chaoting_path', 'court_defender'],
      forbidFlags: ['court_edict_done', 'demon_sect', 'massacre', 'became_bandit'],
    },
    choices: [
      {
        text: '奉诏彻查，不避权贵',
        effects: {
          attrs: { 心性: 6, 正道声望: 12 },
          addFlags: ['court_edict_done', 'court_justice', 'court_agent', 'helped_people'],
          grantTitle: 'junzijian',
          setRelation: { kind: '仇敌', name: '涉案权贵', bond: -55, revengeIn: 4 },
          queueEvents: [
            { id: 'relation_revenge', delayYears: 4 },
            { id: 'court_finale', delayYears: 10 },
          ],
        },
        tendencyTags: ['侠义', '冒险'],
      },
      {
        text: '阳奉阴违，保全各方',
        effects: {
          attrs: { 魅力: 5, 心性: -2, 财富: 15 },
          addFlags: ['court_edict_done', 'court_humble', 'spy', 'court_hero'],
          queueEvent: { id: 'court_finale', delayYears: 8 },
        },
        tendencyTags: ['谨慎', '交际'],
      },
      {
        text: '抗旨出走，从此江湖',
        effects: {
          attrs: { 心性: 4 },
          removeFlags: ['official'],
          addFlags: ['court_edict_done', 'court_refused', 'fugitive', 'wanderer'],
          grantTitle: 'duxing',
          queueEvent: { id: 'wanderer_bounty_board', delayYears: 2 },
        },
        tendencyTags: ['冒险', '谨慎'],
      },
    ],
  },
]
