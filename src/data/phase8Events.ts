import type { EventDef } from '../types'

/** Phase 8：终章第二幕 + 关系第二拍（改命运，禁空气） */
export const PHASE8_EVENTS: EventDef[] = [
  // ═══ 终章后第二幕：中年余波 ═══
  {
    id: 'act2_sect_echo',
    name: '山门余音',
    text: '终章已过数年。同门或故人寻来：有人请你出山断一桩旧案，有人请你为后辈点拨一招——山门的影子，仍跟着你。',
    stages: ['壮年', '晚年'],
    tags: ['门派', '余波'],
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      anyFlags: ['sect_finale', 'huashan_finale_done', 'wudang_finale_done', 'shaolin_finale_done', 'emei_finale_done', 'gaibang_finale_done'],
      forbidFlags: ['act2_mid_done', 'left_sect'],
    },
    choices: [
      {
        text: '再为山门走一遭',
        effects: {
          attrs: { 心性: 4, 正道声望: 6 },
          addFlags: ['act2_mid_done', 'sect_loyal'],
          setRelation: { kind: '挚友', bond: 60, note: '余波同心' },
          logExtra: '你又替山门了结一桩事。江湖上仍有人记着你的门墙。',
        },
        tendencyTags: ['侠义', '修炼'],
      },
      {
        text: '婉拒，只留一封信',
        effects: {
          attrs: { 心性: 2 },
          addFlags: ['act2_mid_done', 'retreated'],
          logExtra: '你回了信，却没有出山。山门的灯，远了也亮着。',
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },
  {
    id: 'act2_wander_mid',
    name: '江湖中场',
    text: '你未入名门，或早已离派。中年路上仍有人拿旧事问你：是再入局，还是把刀收进鞘里。',
    stages: ['壮年', '晚年'],
    tags: ['余波'],
    weight: 1,
    importance: 3,
    needsChoice: true,
    once: true,
    conditions: {
      anyFlags: ['left_sect', 'wanderer', 'sect_aftermath_queued'],
      forbidFlags: ['act2_mid_done'],
    },
    choices: [
      {
        text: '再入一局',
        effects: {
          attrs: { 武力: 3, 福缘: -2 },
          addFlags: ['act2_mid_done', 'battlefield'],
          combat: {
            foePower: 48,
            foeName: '旧局来人',
            onWin: { attrs: { 正道声望: 4 }, logExtra: '你赢了，也更累了。' },
            onLose: { attrs: { 体魄: -20 }, addFlag: 'old_ailing', logExtra: '你败了，留下一身旧伤。' },
          },
        },
        tendencyTags: ['冒险', '狠厉'],
      },
      {
        text: '收刀，寻一处安身',
        effects: {
          attrs: { 心性: 5 },
          addFlags: ['act2_mid_done', 'retreated'],
          logExtra: '你把刀收了。余生或许平静，也或许只是另一种考验。',
        },
        tendencyTags: ['谨慎', '修炼'],
      },
    ],
  },

  // ═══ 晚年归宿 ═══
  {
    id: 'act2_late_home',
    name: '晚岁归宿',
    text: '两鬓已斑。有人劝你开馆授徒，有人劝你入山隐居，也有人说朝堂/江湖都还记得你的名字——你要给自己选一个收场。',
    stages: ['晚年'],
    tags: ['归宿', '结局'],
    weight: 2,
    importance: 4,
    needsChoice: true,
    once: true,
    minAge: 55,
    conditions: { forbidFlags: ['act2_late_done'] },
    choices: [
      {
        text: '开馆授徒，了此一生',
        effects: {
          attrs: { 魅力: 4, 正道声望: 5 },
          addFlags: ['act2_late_done', 'has_student'],
          setRelation: { kind: '徒弟', bond: 70, note: '晚岁传灯' },
          grantTitle: 'xiake',
          logExtra: '你开了馆。江湖少了一柄刀，多了一盏灯。',
        },
        tendencyTags: ['修炼', '交际'],
      },
      {
        text: '入山隐居，不问世事',
        effects: {
          attrs: { 心性: 6, 体魄: -3 },
          addFlags: ['act2_late_done', 'retreated', 'yinshi_path'],
          logExtra: '你入了山。世上的名声，留给别人去争。',
        },
        tendencyTags: ['谨慎', '修炼'],
      },
      {
        text: '再走江湖，至死方休',
        effects: {
          attrs: { 武力: 4, 体魄: -6 },
          addFlags: ['act2_late_done', 'battlefield', 'old_ailing'],
          logExtra: '你选择把路走到黑。晚岁的江湖，比年轻时更凉。',
        },
        tendencyTags: ['冒险', '狠厉'],
      },
    ],
  },

  // ═══ 关系第二拍 ═══
  {
    id: 'rel_lover_fate',
    name: '情缘终局',
    text: '与道侣再见之后，尘埃仍未落定。今日对坐，要的是一个了断：同生、永别，或是把未了的债说清——不是把命赌在酒里。',
    stages: ['壮年', '晚年'],
    tags: ['情缘', '关系'],
    chain: 'love',
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['lover_revisited'],
      forbidFlags: ['lover_fate_done', 'love_finale', 'love_closed'],
      anyFlags: ['lover', 'married'],
    },
    choices: [
      {
        text: '执手余生',
        effects: {
          attrs: { 心性: 8, 魅力: 4 },
          addFlags: ['lover_fate_done', 'married', 'love_finale'],
          setRelation: { kind: '道侣', bond: 90, note: '白首' },
          logExtra: '你们把后半生约在了一起。',
        },
        tendencyTags: ['交际', '侠义'],
      },
      {
        text: '好聚好散',
        effects: {
          attrs: { 心性: 3 },
          addFlags: ['lover_fate_done', 'lost_lover', 'love_closed'],
          setRelation: { kind: '道侣', bond: 20, note: '释然' },
          logExtra: '你们散了，却没有恨。',
        },
        tendencyTags: ['谨慎'],
      },
      {
        text: '情劫难渡，一醉永别',
        effects: {
          addFlags: ['lover_fate_done', 'death_qingjie', 'lost_lover'],
          death: '情劫难渡，自绝于世',
          logExtra: '酒入喉时，你仍念着那个人的名字。',
        },
        // 仅心碎时可选；倾向刻意避开「谨慎」，避免全自动掌门误点自尽
        tendencyTags: ['狠厉'],
        requirements: { maxHeart: -15, anyFlags: ['lost_lover'] },
      },
    ],
  },
  {
    id: 'rel_master_final',
    name: '师父最后一课',
    text: '师父（或师门长辈）病骨支离，招你到榻前：要传你压箱底的一式，或要你发誓不再为师门沾血。',
    stages: ['壮年', '晚年'],
    tags: ['门派', '关系'],
    weight: 1,
    importance: 4,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['master_letter_done'],
      forbidFlags: ['master_final_done', 'left_sect'],
    },
    choices: [
      {
        text: '接过那一式',
        effects: {
          attrs: { 悟性: 5, 心性: 4 },
          addFlags: ['master_final_done', 'sect_loyal'],
          upgradeMartialArt: 'any',
          setRelation: { kind: '师父', bond: 95, note: '最后一课' },
          logExtra: '师父把绝学交了出去，像把命也交了出去。',
        },
        tendencyTags: ['修炼', '侠义'],
      },
      {
        text: '发誓收刀，只守一方',
        effects: {
          attrs: { 心性: 6 },
          addFlags: ['master_final_done', 'retreated'],
          setRelation: { kind: '师父', bond: 80, note: '遵命' },
          logExtra: '你应了誓。师父笑了笑，像终于放心。',
        },
        tendencyTags: ['谨慎'],
      },
    ],
  },
  {
    id: 'rel_disciple_fate',
    name: '徒儿去路',
    text: '徒弟再次出现在你面前：报恩、讨教，或是提着刀。你要决定，这师生缘是传灯还是断义。',
    stages: ['壮年', '晚年'],
    tags: ['关系'],
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    minAge: 45,
    conditions: {
      flags: ['disciple_return_done'],
      forbidFlags: ['disciple_fate_done', 'betrayal_resolved'],
      anyFlags: ['has_student'],
    },
    choices: [
      {
        text: '传灯，认他作半个自己',
        effects: {
          attrs: { 心性: 5, 正道声望: 4 },
          addFlags: ['disciple_fate_done'],
          setRelation: { kind: '徒弟', bond: 90, note: '传灯' },
          upgradeMartialArt: 'any',
          logExtra: '徒儿跪了下去。你把后半生的武，分了一半给他。',
        },
        tendencyTags: ['修炼', '交际'],
      },
      {
        text: '若是逆徒，今日了断',
        effects: {
          addFlags: ['disciple_fate_done', 'hunted_student'],
          combat: {
            foePower: 52,
            foeName: '逆徒',
            onWin: {
              attrs: { 心性: -4 },
              setRelation: { kind: '仇敌', clear: true },
              logExtra: '你赢了。师徒二字，从此是血。',
            },
            onLose: {
              attrs: { 体魄: -25 },
              addFlags: ['old_ailing', 'betrayal_pursuit', 'severe_wound'],
              logExtra: '你败了，却没死在逆徒刀下——命是捡回来的。',
            },
          },
        },
        tendencyTags: ['狠厉', '冒险'],
      },
    ],
  },
  {
    id: 'rel_enemy_last',
    name: '仇敌终局',
    text: '旧仇再一次堵在路上。这次没有「再拖几年」——要么死战，要么放下屠刀。',
    stages: ['壮年', '晚年'],
    tags: ['关系', '战斗'],
    weight: 1,
    importance: 5,
    needsChoice: true,
    once: true,
    conditions: {
      flags: ['enemy_echo_done'],
      forbidFlags: ['enemy_last_done', 'enemy_closed'],
    },
    choices: [
      {
        text: '死战，今日了结',
        effects: {
          addFlag: 'enemy_last_done',
          combat: {
            foePower: 62,
            foeName: '终局仇敌',
            onWin: {
              attrs: { 武力: 5 },
              setRelation: { kind: '仇敌', clear: true },
              removeFlag: 'enemy_due',
              logExtra: '仇尽了。你的手，却还在抖。',
            },
            onLose: { death: '仇敌寻仇，命丧黄泉' },
          },
        },
        tendencyTags: ['冒险', '狠厉'],
      },
      {
        text: '放下，各生各的',
        effects: {
          attrs: { 心性: 8 },
          addFlags: ['enemy_last_done'],
          setRelation: { kind: '仇敌', clear: true },
          removeFlag: 'enemy_due',
          logExtra: '你们都放下了。江湖少了一段仇，多了两道白发。',
        },
        tendencyTags: ['谨慎', '侠义'],
      },
    ],
  },
]
