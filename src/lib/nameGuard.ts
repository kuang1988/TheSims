/** 玩家自定义姓名：字形清洗 + 敏感词拦截（防和谐绕过） */

const NAME_MAX = 6
const FALLBACK = '无名侠客'

/** 零宽 / 控制 / 怪异空格 */
const INVISIBLE =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\u00a0\u3000]/g

/** 允许：汉字、间隔号、少数姓名用符 */
const ALLOWED = /^[\u4e00-\u9fff·•．.、]+$/

/**
 * 谐音 / 拆分 / 形近替换表（检测前归一）
 * 仅用于匹配，不改变展示用清洗结果
 */
const HOMOGLYPH: Record<string, string> = {
  〇: '零',
  Ｏ: 'o',
  ｏ: 'o',
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
  丶: '',
  丨: '',
  丿: '',
  灬: '',
  艹: '',
  氵: '',
  扌: '',
  Б: 'b',
  в: 'b',
  а: 'a',
  е: 'e',
  с: 'c',
  у: 'y',
  х: 'x',
  і: 'i',
}

/** 敏感词（归一化后子串匹配）；故意写短根，覆盖常见变体 */
const BLOCK_ROOTS = [
  // 政治 / 领导人（常见过审词）
  '习近平',
  '李克强',
  '毛泽东',
  '邓小平',
  '江泽民',
  '胡锦涛',
  '温家宝',
  '共产党',
  '共匪',
  '反共',
  '六四',
  '天安门',
  '法轮',
  '轮功',
  '达赖',
  '台独',
  '港独',
  '藏独',
  '疆独',
  '纳粹',
  '希特勒',
  // 辱骂 / 人身攻击
  '傻逼',
  '傻b',
  '煞笔',
  '傻比',
  '草泥马',
  '操你妈',
  '操你',
  '日你',
  '妈逼',
  '妈的逼',
  '狗日',
  '贱人',
  '婊子',
  '混蛋',
  '王八',
  '白痴',
  '智障',
  '脑残',
  '去死',
  '死全家',
  // 色情
  '鸡巴',
  '阴茎',
  '阴道',
  '口交',
  '肛交',
  '性爱',
  '做爱',
  '约炮',
  '援交',
  '色情',
  '黄片',
  '裸体',
  '裸聊',
  '强奸',
  '轮奸',
  '嫖娼',
  '卖淫',
  // 赌博毒品等
  '冰毒',
  '海洛因',
  '可卡因',
  '大麻',
  '吸毒',
  '赌博',
  '赌场',
  // 冒充 / 系统
  '管理员',
  '系统',
  'gm',
  '官方',
  '客服',
  '外挂',
  '作弊',
  // 血腥极端（过短名语境）
  '自杀',
  '自焚',
  '恐怖分子',
]

/** 归一化后再拦的拼音/字母绕过 */
const BLOCK_LATIN = [
  /xijinping/i,
  /xi\s*jin\s*ping/i,
  /falun/i,
  /fuck/i,
  /shit/i,
  /bitch/i,
  /nazi/i,
  /http/i,
  /www\./i,
]

export type NameGuardResult =
  | { ok: true; name: string }
  | { ok: false; name: string; reason: string }

function stripInvisible(s: string): string {
  return s.replace(INVISIBLE, '')
}

function toHalfWidth(s: string): string {
  return s.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

/** 展示用清洗：去不可见字符、空白，限长，仅保留允许字形 */
export function cleanPlayerNameInput(raw: string): string {
  let s = stripInvisible(String(raw ?? ''))
  s = s.replace(/\s+/g, '')
  s = [...s]
    .filter((ch) => ALLOWED.test(ch))
    .join('')
    .slice(0, NAME_MAX)
  return s
}

function normalizeForMatch(s: string): string {
  let t = toHalfWidth(stripInvisible(s)).toLowerCase()
  t = t.replace(/[\s\-_*·•．.、'"“”‘’]/g, '')
  t = [...t].map((ch) => HOMOGLYPH[ch] ?? ch).join('')
  // 去常见插入干扰
  t = t.replace(/[0-9o]+/gi, (m) => (m.length >= 3 ? '' : m))
  return t
}

function hitsBlocklist(normalized: string): boolean {
  if (!normalized) return false
  for (const root of BLOCK_ROOTS) {
    if (normalized.includes(normalizeForMatch(root))) return true
  }
  for (const re of BLOCK_LATIN) {
    if (re.test(normalized)) return true
  }
  return false
}

/**
 * 校验并产出可用姓名。
 * - ok: 可用的干净名
 * - !ok: reason 说明；name 为回退名（fallback）
 */
export function guardPlayerName(raw: string, fallback = FALLBACK): NameGuardResult {
  const cleaned = cleanPlayerNameInput(raw)
  if (!cleaned) {
    return { ok: false, name: fallback, reason: '姓名不能为空，且仅可用汉字' }
  }
  if (cleaned.length < 2) {
    return { ok: false, name: fallback, reason: '姓名至少两个字' }
  }
  if (!ALLOWED.test(cleaned)) {
    return { ok: false, name: fallback, reason: '姓名仅可用汉字' }
  }
  const norm = normalizeForMatch(cleaned)
  if (hitsBlocklist(norm)) {
    return { ok: false, name: fallback, reason: '此名不宜落墨，请另择雅字' }
  }
  // 纯重复字刷屏（如「啊啊啊啊」）
  if ([...cleaned].every((ch) => ch === cleaned[0]) && cleaned.length >= 3) {
    return { ok: false, name: fallback, reason: '姓名过于单一，请另择' }
  }
  return { ok: true, name: cleaned }
}

export const NAME_FALLBACK = FALLBACK
export const NAME_MAX_LEN = NAME_MAX
