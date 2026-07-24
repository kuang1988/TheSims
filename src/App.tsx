import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildEnding,
  calcForce,
  createBirth,
  getMartial,
  getOrigin,
  getTitle,
  getTrait,
  LifeSimulator,
} from './engine/simulator'
import { heartTier } from './lib/utils'
import {
  formatShareText,
  loadStats,
  recordRunStats,
  statsSummary,
  type RunStats,
} from './lib/story'
import {
  codexProgress,
  loadCodex,
  syncCodexFromEnding,
  type AchievementDef,
  type CodexState,
} from './lib/meta'
import { LifeBook } from './components/LifeBook'
import { HomeScreen } from './components/HomeScreen'
import { LifeShelf } from './components/LifeShelf'
import { CodexScreen } from './components/CodexScreen'
import { downloadShareCard } from './lib/shareCard'
import {
  loadShelf,
  markShelfRead,
  removeShelfBook,
  upsertShelfBook,
  type LifeBookRecord,
} from './lib/lifeShelf'
import { primaryDeathTag } from './lib/deathTags'
import {
  artUrlForLog,
  climaxUrlFromHighlight,
  endingDeathUrl,
  normalizePortraitLook,
  PORTRAIT_LABELS,
  portraitPoolForGender,
  portraitUrl,
  portraitUrlFor,
} from './lib/assetResolve'
import { matchSynergies } from './data/synergies'
import { TRAITS } from './data/traits'
import type { PortraitArchetype } from './data/assetManifest'
import type {
  Character,
  ChoiceDef,
  EndingReport,
  LogEntry,
  PendingChoice,
  PlayMode,
  Screen,
} from './types'
import './App.css'

type GenderOption = '男' | '女' | '随机'

const PREFS_KEY = 'wuxia-life-sim-prefs-v1'

interface PlayPrefs {
  mode: PlayMode
  autoSpeed: number
  majorOnly: boolean
  foldLowLogs: boolean
}

function loadPlayPrefs(): PlayPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) {
      return { mode: 'auto', autoSpeed: 5, majorOnly: true, foldLowLogs: true }
    }
    const p = JSON.parse(raw) as Partial<PlayPrefs>
    return {
      mode: p.mode === 'semi' ? 'semi' : 'auto',
      autoSpeed: Math.min(8, Math.max(1, Number(p.autoSpeed) || 5)),
      majorOnly: p.majorOnly !== false,
      foldLowLogs: p.foldLowLogs !== false,
    }
  } catch {
    return { mode: 'auto', autoSpeed: 5, majorOnly: true, foldLowLogs: true }
  }
}

function savePlayPrefs(p: PlayPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

function createInitialBirth() {
  const s = Date.now() % 1_000_000_000
  return {
    seed: s,
    character: createBirth(s, undefined, {
      unlockedAchievements: loadCodex().achievements,
    }),
  }
}

function displayName(c: Character): string {
  if (!c.primaryTitleId) return c.name
  return `${c.name} · ${getTitle(c.primaryTitleId).name}`
}

function AttrBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, ((value + (label === '心性' ? 100 : 0)) / (label === '心性' ? 200 : max)) * 100))
  return (
    <div className="attr-bar">
      <div className="attr-bar__label">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="attr-bar__track">
        <div className="attr-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [boot] = useState(createInitialBirth)
  const [seed, setSeed] = useState(boot.seed)
  const [genderOption, setGenderOption] = useState<GenderOption>('随机')
  const [codex, setCodex] = useState<CodexState>(() => loadCodex())
  const [lockedTraitId, setLockedTraitId] = useState<string>('')
  const [character, setCharacter] = useState<Character>(boot.character)
  const [prefs] = useState(loadPlayPrefs)
  const [mode, setMode] = useState<PlayMode>(prefs.mode)
  const [majorOnly, setMajorOnly] = useState(prefs.majorOnly)
  const [autoSpeed, setAutoSpeed] = useState(prefs.autoSpeed)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pending, setPending] = useState<PendingChoice | null>(null)
  const [ending, setEnding] = useState<EndingReport | null>(null)
  const [showStatus, setShowStatus] = useState(false)
  const [showEndingDetail, setShowEndingDetail] = useState(false)
  const [showLifeReview, setShowLifeReview] = useState(false)
  const [showAllTitles, setShowAllTitles] = useState(false)
  const [reviewClimaxOnly, setReviewClimaxOnly] = useState(false)
  const [foldLowLogs, setFoldLowLogs] = useState(prefs.foldLowLogs)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'err' | 'info' } | null>(null)
  const [ritualTip, setRitualTip] = useState('')
  const [logFlash, setLogFlash] = useState(false)
  const [runStats, setRunStats] = useState<RunStats>(() => loadStats())
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([])
  const [showSeedRoom, setShowSeedRoom] = useState(false)
  const [seedInput, setSeedInput] = useState('')
  const [showBirthExtras, setShowBirthExtras] = useState(false)
  const [showEndingLoot, setShowEndingLoot] = useState(false)
  const [showLifePortraitPicker, setShowLifePortraitPicker] = useState(false)
  const [readAsBook, setReadAsBook] = useState(true)
  const [endingReadAsBook, setEndingReadAsBook] = useState(true)
  const [shelfBooks, setShelfBooks] = useState<LifeBookRecord[]>(() => loadShelf())
  const [openShelfBook, setOpenShelfBook] = useState<LifeBookRecord | null>(null)

  const simRef = useRef<LifeSimulator | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const logStreamRef = useRef<HTMLDivElement | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((message: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    setToast({ message, kind })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2000)
  }, [])

  useEffect(() => {
    savePlayPrefs({ mode, autoSpeed, majorOnly, foldLowLogs })
  }, [mode, autoSpeed, majorOnly, foldLowLogs])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const canLockTrait = codex.achievements.length >= 1

  const resolveGender = (option: GenderOption): '男' | '女' | undefined => {
    if (option === '男' || option === '女') return option
    return undefined
  }

  const rollBirth = (s: number, option: GenderOption = genderOption, lockId: string = lockedTraitId) => {
    setSeed(s)
    setCharacter(
      createBirth(s, resolveGender(option), {
        lockedTraitIds: lockId ? [lockId] : [],
        unlockedAchievements: codex.achievements,
      }),
    )
  }

  const reroll = () => {
    const s = (Date.now() + Math.floor(Math.random() * 99999)) % 1_000_000_000
    rollBirth(s)
  }

  const applySeed = () => {
    const n = Number(seedInput.trim())
    if (!Number.isFinite(n) || n < 0) {
      showToast('请输入有效的非负整数种子', 'err')
      return
    }
    rollBirth(Math.floor(n) % 1_000_000_000)
    showToast('已载入种子（同 seed 可比抉择）', 'ok')
  }

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(seed))
      showToast('种子已复制', 'ok')
    } catch {
      showToast('复制失败', 'err')
    }
  }

  const changeGender = (option: GenderOption) => {
    setGenderOption(option)
    rollBirth(seed, option)
  }

  const applyPortraitLook = (look: PortraitArchetype) => {
    const next = normalizePortraitLook(character.gender, look)
    setCharacter((c) => ({ ...c, portraitLook: next }))
    if (simRef.current) simRef.current.character.portraitLook = next
    if (ending) {
      setEnding({
        ...ending,
        character: { ...ending.character, portraitLook: next },
      })
    }
  }

  const cyclePortraitLook = () => {
    const pool = portraitPoolForGender(character.gender)
    const cur = normalizePortraitLook(character.gender, character.portraitLook)
    const i = Math.max(0, pool.indexOf(cur))
    applyPortraitLook(pool[(i + 1) % pool.length] ?? 'civic')
  }

  const portraitChoices = useMemo(
    () => portraitPoolForGender(character.gender),
    [character.gender],
  )

  const origin = useMemo(() => getOrigin(character.originId), [character.originId])
  const traits = useMemo(() => character.traitIds.map(getTrait), [character.traitIds])
  const synergies = useMemo(() => matchSynergies(character.traitIds), [character.traitIds])
  const lockableTraits = useMemo(
    () => TRAITS.filter((t) => !t.unlockBy || codex.achievements.includes(t.unlockBy)),
    [codex.achievements],
  )

  const startLife = () => {
    const c = structuredClone(character)
    const sim = new LifeSimulator(c, seed ^ 0x9e3779b9, mode, majorOnly)
    const intro: LogEntry = {
      age: 0,
      kind: 'system',
      title: '入世',
      text: `${displayName(c)}（${c.gender}）生于乱世。出身${origin.name}。模式：${mode === 'auto' ? '全自动' : '半自动'}。`,
      importance: 3,
    }
    sim.logs.push(intro)
    simRef.current = sim
    setCharacter(structuredClone(sim.character))
    setLogs([...sim.logs])
    setPending(null)
    setEnding(null)
    setScreen('life')
    setShowStatus(false)
    // 全自动立即开跑；半自动等玩家点继续/活一年
    setRunning(mode === 'auto')
  }

  const finish = useCallback((sim: LifeSimulator) => {
    setRunning(false)
    setPending(null)
    setCharacter(structuredClone(sim.character))
    setLogs([...sim.logs])
    const report = buildEnding(sim)
    setEnding(report)
    setShowEndingDetail(false)
    setShowLifeReview(false)
    setReviewClimaxOnly(false)
    setEndingReadAsBook(true)
    setRunStats(recordRunStats(report))
    const synced = syncCodexFromEnding(report)
    setCodex(synced.codex)
    setNewAchievements(synced.newAchievements)
    const originLabel = getOrigin(report.character.originId).name
    setShelfBooks(upsertShelfBook(report, seed, originLabel))
    setScreen('ending')
  }, [seed])

  const goHome = () => {
    setRunning(false)
    setPending(null)
    setEnding(null)
    setOpenShelfBook(null)
    setShowStatus(false)
    simRef.current = null
    setScreen('home')
  }

  const openShelfBookReader = (book: LifeBookRecord) => {
    setOpenShelfBook(book)
    setShelfBooks(markShelfRead(book.id))
    setScreen('book')
  }

  const appendFromSim = useCallback((sim: LifeSimulator) => {
    setCharacter(structuredClone(sim.character))
    setLogs([...sim.logs])
  }, [])

  const stepYear = useCallback(() => {
    const sim = simRef.current
    if (!sim || sim.ended) return
    const before = sim.logs.length
    const result = sim.advanceYear()
    appendFromSim(sim)
    const gained = sim.logs.slice(before)
    const ritual = gained.find(
      (l) =>
        (l.kind === 'martial' && l.importance >= 4) ||
        (l.kind === 'title' && l.importance >= 5),
    )
    if (ritual && mode === 'semi') {
      setRitualTip(ritual.text)
      setRunning(false)
      window.setTimeout(() => setRitualTip(''), 2200)
    }
    if (mode === 'auto' && gained.some((l) => l.importance >= 5)) {
      setLogFlash(true)
      window.setTimeout(() => setLogFlash(false), 850)
      const flash = gained.find((l) => l.importance >= 5)
      if (flash) {
        setRitualTip(flash.title)
        window.setTimeout(() => setRitualTip(''), 1600)
      }
    }
    if (result.pendingChoice) {
      setPending(result.pendingChoice)
      setRunning(false)
      return
    }
    if (result.died) finish(sim)
  }, [appendFromSim, finish, mode])

  const choose = (choice: ChoiceDef) => {
    const sim = simRef.current
    if (!sim) return
    const before = sim.logs.length
    const result = sim.resolvePending(choice)
    setPending(null)
    appendFromSim(sim)
    const gained = sim.logs.slice(before)
    const ritual = gained.find(
      (l) =>
        (l.kind === 'martial' && l.importance >= 4) ||
        (l.kind === 'title' && l.importance >= 5),
    )
    if (ritual) {
      setRitualTip(ritual.text)
      window.setTimeout(() => setRitualTip(''), 2200)
    }
    if (result.died) {
      finish(sim)
      return
    }
    // 抉择后继续自动推进（全自动/半自动皆可）
    setRunning(true)
  }

  // 自动推进：用年龄驱动下一轮，避免「无新日志」时卡死
  useEffect(() => {
    if (screen !== 'life' || !running || pending) return
    if (simRef.current?.ended) return
    const delay = mode === 'auto' ? Math.max(30, 280 / autoSpeed) : 420
    const t = window.setTimeout(() => {
      stepYear()
    }, delay)
    return () => clearTimeout(t)
  }, [screen, running, pending, mode, autoSpeed, stepYear, character.age])

  useEffect(() => {
    const stream = logStreamRef.current
    if (!stream || !logEndRef.current) return
    const distance = stream.scrollHeight - stream.scrollTop - stream.clientHeight
    // 用户上翻阅读时不抢滚动
    if (distance < 120) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [logs.length, pending])

  const visibleLogs = useMemo(() => {
    if (mode !== 'auto' || !foldLowLogs) return logs
    return logs.filter(
      (l) =>
        l.importance >= 3 ||
        l.kind === 'title' ||
        l.kind === 'death' ||
        l.kind === 'system' ||
        l.title === '入世',
    )
  }, [logs, mode, foldLowLogs])

  const reviewLogs = useMemo(() => {
    if (!ending) return []
    if (!reviewClimaxOnly) return ending.lifeLog
    return ending.lifeLog.filter(
      (l) =>
        l.importance >= 3 ||
        l.kind === 'title' ||
        l.kind === 'death' ||
        l.kind === 'system' ||
        l.title === '入世',
    )
  }, [ending, reviewClimaxOnly])

  const endingDeathArt = useMemo(
    () => (ending ? endingDeathUrl(ending.deathReason, ending.character) : null),
    [ending],
  )
  const endingPortraitArt = useMemo(
    () => (ending ? portraitUrl(ending.character) : null),
    [ending],
  )

  const copyEnding = async () => {
    if (!ending) return
    const text = formatShareText(ending, seed)
    try {
      await navigator.clipboard.writeText(text)
      showToast('已复制生平短传', 'ok')
    } catch {
      showToast('复制失败，请手动选择文本', 'err')
    }
  }

  return (
    <div className="app">
      <div className="bg-ink" aria-hidden />
      {toast && (
        <div className="toast-host" role="status" aria-live="polite">
          <div className={`toast toast--${toast.kind}`}>{toast.message}</div>
        </div>
      )}
      <header className="topbar">
        <button type="button" className="brand brand--btn" onClick={goHome}>
          武侠人生模拟器
        </button>
        {screen === 'life' && (
          <div className="topbar__actions">
            <button type="button" className="btn ghost" onClick={() => setShowStatus((v) => !v)}>
              {showStatus ? '返回日志' : '状态'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setRunning((v) => !v)}
              disabled={!!pending}
            >
              {running ? '暂停' : '继续'}
            </button>
          </div>
        )}
        {(screen === 'birth' ||
          screen === 'ending' ||
          screen === 'shelf' ||
          screen === 'book' ||
          screen === 'codex') && (
          <div className="topbar__actions">
            <button type="button" className="btn ghost" onClick={goHome}>
              大厅
            </button>
            {screen !== 'shelf' && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setOpenShelfBook(null)
                  setScreen('shelf')
                }}
              >
                我的人生
              </button>
            )}
            {screen !== 'codex' && (
              <button type="button" className="btn ghost" onClick={() => setScreen('codex')}>
                成就图鉴
              </button>
            )}
          </div>
        )}
      </header>

      <main className="main">
        {screen === 'home' && (
          <HomeScreen
            shelfCount={shelfBooks.length}
            onStart={() => setScreen('birth')}
            onShelf={() => setScreen('shelf')}
            onCodex={() => setScreen('codex')}
          />
        )}

        {screen === 'shelf' && (
          <LifeShelf
            books={shelfBooks}
            onOpen={openShelfBookReader}
            onBack={goHome}
            onStart={() => setScreen('birth')}
            onRemove={(id) => {
              setShelfBooks(removeShelfBook(id))
              showToast('已移出书架', 'ok')
            }}
          />
        )}

        {screen === 'codex' && <CodexScreen codex={codex} onBack={goHome} />}

        {screen === 'book' && openShelfBook && (
          <section className="panel ending-book-wrap shelf-reader">
            <LifeBook
              logs={openShelfBook.ending.lifeLog}
              character={openShelfBook.ending.character}
              seed={openShelfBook.seed}
              ending={openShelfBook.ending}
              originName={openShelfBook.originName}
              mode="reading"
              realisticFlip
              onBack={() => {
                setOpenShelfBook(null)
                setScreen('shelf')
              }}
              onShare={() => {
                void downloadShareCard(openShelfBook.ending, openShelfBook.seed).then(() => {
                  showToast('已生成分享图', 'ok')
                })
              }}
            />
          </section>
        )}

        {screen === 'birth' && (
          <section className="panel birth">
            <p className="eyebrow">入世之前 · 天命已定</p>
            <div className="birth-hero">
              <img
                className="birth-hero__portrait"
                src={portraitUrl(character)}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="birth-hero__copy">
                <h1>{character.name}</h1>
                <p className="lead">
                  {character.gender} · {origin.name}
                  <span className="muted">（{origin.desc}）</span>
                </p>
              </div>
            </div>

            <div className="mode-row gender-row">
              <span className="field-label">性别</span>
              {(['男', '女', '随机'] as GenderOption[]).map((g) => (
                <label key={g} className={genderOption === g ? 'active' : ''}>
                  <input
                    type="radio"
                    name="gender"
                    checked={genderOption === g}
                    onChange={() => changeGender(g)}
                  />
                  {g}
                </label>
              ))}
            </div>

            <div className="portrait-picker">
              <div className="portrait-picker__bar">
                <span className="field-label">立绘</span>
                <span className="portrait-picker__current">
                  {PORTRAIT_LABELS[normalizePortraitLook(character.gender, character.portraitLook)]}
                </span>
                <button type="button" className="btn tiny" onClick={cyclePortraitLook}>
                  换一脸
                </button>
              </div>
              <div className="portrait-picker__grid" role="listbox" aria-label="选择立绘">
                {portraitChoices.map((look) => {
                  const active =
                    normalizePortraitLook(character.gender, character.portraitLook) === look
                  return (
                    <button
                      key={look}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`portrait-picker__item${active ? ' is-active' : ''}`}
                      onClick={() => applyPortraitLook(look)}
                    >
                      <img
                        src={portraitUrlFor(character.gender, look)}
                        alt={PORTRAIT_LABELS[look]}
                        loading="lazy"
                      />
                      <span>{PORTRAIT_LABELS[look]}</span>
                    </button>
                  )
                })}
              </div>
              <p className="meta portrait-picker__hint">点选缩略图更换；入世后不会因门派自动换脸。</p>
            </div>

            <div className="birth-traits">
              <h3>天赋词条</h3>
              <ul className="trait-list">
                {traits.map((t) => (
                  <li key={t.id}>
                    <strong>
                      {t.name}
                      <em>{t.rarity}</em>
                      {lockedTraitId === t.id ? ' · 已锁' : ''}
                    </strong>
                    <span>{t.desc}</span>
                  </li>
                ))}
              </ul>
              {synergies.length > 0 && (
                <div className="synergy-box">
                  <h4>词条联动</h4>
                  <ul className="trait-list compact">
                    {synergies.map((s) => (
                      <li key={s.id}>
                        <strong>{s.name}</strong>
                        <span>{s.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="meta">预计寿元约 {character.lifespan} 岁 · 种子 {seed}</p>
            </div>

            <div className="mode-row compact-mode">
              <label className={mode === 'auto' ? 'active' : ''}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'auto'}
                  onChange={() => setMode('auto')}
                />
                全自动
              </label>
              <label className={mode === 'semi' ? 'active' : ''}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'semi'}
                  onChange={() => setMode('semi')}
                />
                半自动
              </label>
            </div>

            <button
              type="button"
              className="btn birth-extras-toggle"
              onClick={() => setShowBirthExtras((v) => !v)}
            >
              {showBirthExtras ? '收起详细设定' : '展开属性 / 倍速 / 图鉴统计'}
            </button>

            {showBirthExtras && (
              <div className="birth-extras">
                <div className="grid-2">
                  <div>
                    <h3>属性</h3>
                    {(Object.keys(character.attrs) as (keyof Character['attrs'])[]).map((k) => (
                      <AttrBar
                        key={k}
                        label={k === '心性' ? `心性·${heartTier(character.attrs.心性)}` : k}
                        value={character.attrs[k]}
                      />
                    ))}
                    <p className="meta stats-line">{statsSummary(runStats)}</p>
                    <p className="meta stats-line">
                      图鉴 成就 {codexProgress(codex).achievements} · 武学{' '}
                      {codexProgress(codex).martialArts} · 称号 {codexProgress(codex).titles}
                    </p>
                  </div>
                  <div>
                    {mode === 'semi' && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={majorOnly}
                          onChange={(e) => setMajorOnly(e.target.checked)}
                        />
                        仅重大抉择暂停（推荐，约 8–20 次）
                      </label>
                    )}
                    {mode === 'auto' && (
                      <label className="speed">
                        倍速
                        <input
                          type="range"
                          min={1}
                          max={8}
                          value={autoSpeed}
                          onChange={(e) => setAutoSpeed(Number(e.target.value))}
                        />
                        <span>×{autoSpeed}</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="cta-row">
              <button type="button" className="btn primary" onClick={startLife}>
                开始人生
              </button>
              <button type="button" className="btn" onClick={reroll}>
                重开天命
              </button>
              <button type="button" className="btn" onClick={() => setShowSeedRoom((v) => !v)}>
                {showSeedRoom ? '收起种子房' : '种子房'}
              </button>
              <button type="button" className="btn" onClick={() => setScreen('codex')}>
                成就图鉴
              </button>
            </div>
            {showSeedRoom && (
              <div className="seed-room">
                <h3>种子房 · 同命不同抉择</h3>
                <p className="meta">当前种子 {seed}。分享种子后，对方可用半自动走出另一条人生。</p>
                <div className="seed-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="输入种子"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                  />
                  <button type="button" className="btn" onClick={applySeed}>
                    载入
                  </button>
                  <button type="button" className="btn" onClick={copySeed}>
                    复制种子
                  </button>
                </div>
                {canLockTrait ? (
                  <label className="lock-trait">
                    锁定一词条再重开
                    <select
                      value={lockedTraitId}
                      onChange={(e) => {
                        const id = e.target.value
                        setLockedTraitId(id)
                        rollBirth(seed, genderOption, id)
                      }}
                    >
                      <option value="">不锁定</option>
                      {lockableTraits.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}（{t.rarity}）
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="muted">解锁任意成就后，可锁定 1 个词条再随机其余。</p>
                )}
              </div>
            )}
          </section>
        )}

        {screen === 'life' && (
          <section className="life">
            <aside className="hud">
              <div className="hud__top">
                <img
                  className="hud__portrait"
                  src={portraitUrl(character)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="hud__identity">
                  <div className="hud__name">{displayName(character)}</div>
                  {ritualTip && <p className="ritual-banner">{ritualTip}</p>}
                  <div className="hud__row">
                    <span>{character.age} 岁</span>
                    <span>{character.gender}</span>
                    <span>{character.realm}</span>
                    <span>战力 {calcForce(character)}</span>
                  </div>
                </div>
              </div>
              <div className="hud__row muted">
                <span>体魄 {character.attrs.体魄}</span>
                <span>
                  心性 {heartTier(character.attrs.心性)}（{character.attrs.心性}）
                </span>
              </div>
              <div className="hud__row muted">
                <span>银两 {character.wealth}</span>
                <span>武学 {character.martialArts.length}</span>
                <span>称号 {character.titles.length}</span>
                <span>关系 {character.relations.length}</span>
              </div>
              {mode === 'auto' && (
                <label className="fold-toggle">
                  <input
                    type="checkbox"
                    checked={foldLowLogs}
                    onChange={(e) => setFoldLowLogs(e.target.checked)}
                  />
                  折叠日常（只看高潮）
                </label>
              )}
              <div className="hud__portrait-tools">
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => setShowLifePortraitPicker((v) => !v)}
                >
                  {showLifePortraitPicker ? '收起立绘' : '更换立绘'}
                </button>
                {showLifePortraitPicker && (
                  <div className="portrait-picker__grid portrait-picker__grid--compact">
                    {portraitChoices.map((look) => {
                      const active =
                        normalizePortraitLook(character.gender, character.portraitLook) === look
                      return (
                        <button
                          key={look}
                          type="button"
                          className={`portrait-picker__item${active ? ' is-active' : ''}`}
                          onClick={() => applyPortraitLook(look)}
                        >
                          <img src={portraitUrlFor(character.gender, look)} alt="" />
                          <span>{PORTRAIT_LABELS[look]}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </aside>

            {showStatus ? (
              <StatusPanel character={character} onSetPrimary={(id) => {
                const sim = simRef.current
                if (!sim) return
                sim.character.primaryTitleId = id
                setCharacter(structuredClone(sim.character))
              }} />
            ) : (
              <div className={`log-panel${logFlash ? ' log-panel--flash' : ''}`}>
                <div className="read-mode-bar">
                  <label className="fold-toggle">
                    <input
                      type="checkbox"
                      checked={readAsBook}
                      onChange={(e) => setReadAsBook(e.target.checked)}
                    />
                    书本阅读（一生一书）
                  </label>
                </div>

                {readAsBook ? (
                  <LifeBook
                    logs={logs}
                    character={character}
                    seed={seed}
                    originName={origin.name}
                    mode="live"
                  />
                ) : (
                  <div className="log-stream" ref={logStreamRef}>
                    {mode === 'auto' && foldLowLogs && logs.length !== visibleLogs.length && (
                      <p className="log-fold-hint muted">
                        已折叠 {logs.length - visibleLogs.length} 条日常，可取消上方勾选查看全文
                      </p>
                    )}
                    {visibleLogs.map((l, i) => (
                      <LifeLogArticle
                        key={`${l.age}-${i}-${l.title}`}
                        log={l}
                        character={character}
                      />
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}

                {pending && (
                  <div className="choice-box">
                    <h3>如何抉择？</h3>
                    <p className="choice-box__hint">此岔路口将改写后半生，请择一路。</p>
                    {(() => {
                      const pendingArt = artUrlForLog(
                        {
                          age: character.age,
                          kind: 'event',
                          title: pending.event.name,
                          text: pending.event.text,
                          importance: pending.event.importance,
                          eventId: pending.event.id,
                        },
                        character,
                      )
                      return pendingArt ? (
                        <img
                          className="choice-box__art"
                          src={pendingArt}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : null
                    })()}
                    <div className="choice-list">
                      {pending.choices.map((ch, i) => (
                        <button key={i} type="button" className="btn choice" onClick={() => choose(ch)}>
                          {ch.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mode === 'semi' && !pending && !running && (
                  <div className="semi-actions">
                    <p className="semi-actions__hint">推演会自动经过日常；遇重大抉择时会再次停下。</p>
                    <div className="cta-row">
                      <button type="button" className="btn primary" onClick={() => setRunning(true)}>
                        继续推演人生
                      </button>
                      <button type="button" className="btn" onClick={stepYear}>
                        只过一年
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {screen === 'ending' && ending && (
          <section className="panel ending">
            <p className="eyebrow">尘埃落定</p>
            <div className="ending-hero">
              <div className="ending-hero__art">
                {endingDeathArt && (
                  <img
                    className="ending-hero__death"
                    src={endingDeathArt}
                    alt=""
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>
              <div className="ending-hero__copy">
                {endingPortraitArt && (
                  <img
                    className="ending-hero__portrait"
                    src={endingPortraitArt}
                    alt=""
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <p className="death-tag">{primaryDeathTag(ending.deathReason, ending.character)}</p>
                <h1 className="death">{ending.deathReason}</h1>
                <p className="ending-who">{displayName(ending.character)}</p>
                <p className="mainline-tag">本局主线 · {ending.mainline}</p>
                <div className="tags">
                  {ending.endingTags.map((t) => (
                    <span
                      key={t}
                      className={
                        t === primaryDeathTag(ending.deathReason, ending.character) ? 'tag-primary' : ''
                      }
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="summary ending-summary-lead">{ending.summary}</p>
            <p className="score">本局评分 {ending.score}</p>

            <div className="cta-row ending-share">
              <button type="button" className="btn primary" onClick={copyEnding}>
                复制生平短传
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void downloadShareCard(ending, seed).then(() => {
                    showToast('已生成分享图', 'ok')
                  })
                }}
              >
                下载分享图
              </button>
            </div>

            <div className="cta-row ending-inspect">
              <button
                type="button"
                className={`btn ${endingReadAsBook ? 'primary' : ''}`}
                onClick={() => setEndingReadAsBook(true)}
              >
                翻书回顾
              </button>
              <button
                type="button"
                className={`btn ${!endingReadAsBook && showLifeReview ? 'primary' : ''}`}
                onClick={() => {
                  setEndingReadAsBook(false)
                  setShowLifeReview(true)
                  setShowEndingDetail(false)
                }}
              >
                卷轴回顾
              </button>
              <button
                type="button"
                className={`btn ${showEndingDetail ? 'primary' : ''}`}
                onClick={() => {
                  setShowEndingDetail((v) => !v)
                  if (!showEndingDetail) {
                    setShowLifeReview(false)
                    setEndingReadAsBook(false)
                  }
                }}
              >
                {showEndingDetail ? '收起详细属性' : '查看详细属性'}
              </button>
              <button
                type="button"
                className={`btn ${showEndingLoot ? 'primary' : ''}`}
                onClick={() => setShowEndingLoot((v) => !v)}
              >
                {showEndingLoot ? '收起武学名号' : '武学 / 名号 / 高潮'}
              </button>
            </div>

            {newAchievements.length > 0 && (
              <div className="new-achievements">
                <h3>新成就解锁</h3>
                <ul>
                  {newAchievements.map((a) => (
                    <li key={a.id}>
                      <strong>{a.name}</strong>
                      <span>{a.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {endingReadAsBook && (
              <div className="ending-book-wrap">
                <LifeBook
                  logs={ending.lifeLog}
                  character={ending.character}
                  seed={seed}
                  ending={ending}
                  originName={getOrigin(ending.character.originId).name}
                  mode="reading"
                  realisticFlip
                  onShare={() => {
                    void downloadShareCard(ending, seed).then(() => {
                      showToast('已生成分享图', 'ok')
                    })
                  }}
                />
              </div>
            )}

            {!endingReadAsBook && showLifeReview && (
              <div className="life-review">
                <div className="life-review__head">
                  <h2>一生回顾（卷轴）</h2>
                  <label className="fold-toggle">
                    <input
                      type="checkbox"
                      checked={reviewClimaxOnly}
                      onChange={(e) => setReviewClimaxOnly(e.target.checked)}
                    />
                    仅看高潮
                  </label>
                </div>
                <p className="meta">
                  共 {ending.lifeLog.length} 条记载
                  {reviewClimaxOnly ? `，当前显示 ${reviewLogs.length} 条` : ''}
                </p>
                <div className="life-review__stream">
                  {reviewLogs.length === 0 ? (
                    <p className="muted">暂无记载可回顾。</p>
                  ) : (
                    reviewLogs.map((l, i) => (
                      <LifeLogArticle
                        key={`review-${l.age}-${i}-${l.title}`}
                        log={l}
                        character={ending.character}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {showEndingDetail && (
              <StatusPanel
                character={ending.character}
                title="终局详情"
                readOnly
                showOrigin
              />
            )}

            {showEndingLoot && (
              <div className="ending-loot">
                {ending.highlights.length > 0 && (
                  <>
                    <h3>生平高潮</h3>
                    <ul className="highlight-list">
                      {ending.highlights.map((h) => {
                        const climaxSrc = climaxUrlFromHighlight(h)
                        return (
                          <li key={h} className="highlight-item">
                            {climaxSrc && (
                              <img
                                className="highlight-item__img"
                                src={climaxSrc}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <span className="highlight-item__text">{h}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}

                <h3>最终武学</h3>
                {ending.character.martialArts.length === 0 ? (
                  <p className="muted">尚不会武，只凭蛮力走完一生。</p>
                ) : (
                  <ul className="martial-list">
                    {ending.character.martialArts.map((m) => {
                      const d = getMartial(m.id)
                      return (
                        <li key={m.id}>
                          <strong>{d.name}</strong>
                          <span>
                            {d.type} · {d.grade} · {m.level}层
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <h3>名号</h3>
                {ending.character.titles.length === 0 ? (
                  <p className="muted">未曾留下响亮名号。</p>
                ) : (
                  <>
                    {ending.character.primaryTitleId && (
                      <p className="primary-title-line">
                        主称「{getTitle(ending.character.primaryTitleId).name}」
                        <span className="meta">
                          {' '}
                          · {getTitle(ending.character.primaryTitleId).rarity}
                        </span>
                      </p>
                    )}
                    {ending.character.titles.length > 1 && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setShowAllTitles((v) => !v)}
                      >
                        {showAllTitles
                          ? '收起全部名号'
                          : `展开其余 ${ending.character.titles.length - (ending.character.primaryTitleId ? 1 : 0)} 个名号`}
                      </button>
                    )}
                    {showAllTitles && (
                      <ul className="title-list">
                        {ending.character.titles.map((t) => {
                          const d = getTitle(t.id)
                          return (
                            <li key={t.id}>
                              <strong>
                                {d.name}
                                {ending.character.primaryTitleId === t.id ? '（主）' : ''}
                              </strong>
                              <span>
                                {t.gainedAt}岁 · {d.rarity}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="cta-row">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  reroll()
                  setScreen('birth')
                  setEnding(null)
                  setShowEndingDetail(false)
                  setShowLifeReview(false)
                  setShowAllTitles(false)
                  setShowEndingLoot(false)
                  setNewAchievements([])
                  simRef.current = null
                }}
              >
                再开一局
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setScreen('shelf')
                }}
              >
                我的人生
              </button>
              <button type="button" className="btn" onClick={goHome}>
                返回大厅
              </button>
              <button type="button" className="btn" onClick={() => setScreen('codex')}>
                成就图鉴
              </button>
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

function LifeLogArticle({ log, character }: { log: LogEntry; character: Character }) {
  const art = artUrlForLog(log, character)
  return (
    <article
      className={`log log--${log.kind} imp-${log.importance}${log.importance >= 4 ? ' log--climax' : ''}${art ? ' log--has-art' : ''}`}
    >
      <header>
        <span className="log__age">{log.age}岁</span>
        <strong>{log.title}</strong>
      </header>
      {art && (
        <img
          className="log__art"
          src={art}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <p>{log.text}</p>
    </article>
  )
}

function StatusPanel({
  character,
  onSetPrimary,
  title = '角色状态',
  readOnly = false,
  showOrigin = false,
}: {
  character: Character
  onSetPrimary?: (id: string) => void
  title?: string
  readOnly?: boolean
  showOrigin?: boolean
}) {
  const origin = showOrigin ? getOrigin(character.originId) : null
  return (
    <div className={`status-panel ${readOnly ? 'status-panel--embedded' : 'panel'}`}>
      <div className="status-panel__head">
        <img
          className="status-panel__portrait"
          src={portraitUrl(character)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div>
          <h2>{title}</h2>
          {origin && (
            <p className="meta ending-identity">
              {character.name} · {character.gender} · 出身{origin.name} · 享年{character.age}岁
            </p>
          )}
        </div>
      </div>
      <div className="grid-2">
        <div>
          <h3>属性</h3>
          {(Object.keys(character.attrs) as (keyof Character['attrs'])[]).map((k) => (
            <AttrBar
              key={k}
              label={k === '心性' ? `心性·${heartTier(character.attrs.心性)}` : k}
              value={character.attrs[k]}
            />
          ))}
          <p className="meta">
            境界 {character.realm} · 战力 {calcForce(character)} · 寿元上限 {character.lifespan}
          </p>
          <p className="meta">
            正道声望 {character.fameGood} · 邪道威名 {character.fameEvil} · 财富 {character.wealth}
          </p>
        </div>
        <div>
          <h3>天赋</h3>
          <ul className="trait-list compact">
            {character.traitIds.map((id) => {
              const t = getTrait(id)
              return (
                <li key={id}>
                  <strong>{t.name}</strong>
                  <span>{t.desc}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <h3>人际关系</h3>
      {character.relations.length === 0 ? (
        <p className="muted">尚无固定人事牵绊。</p>
      ) : (
        <ul className="relation-list">
          {character.relations.map((r) => (
            <li key={`${r.kind}-${r.name}`}>
              <strong>
                {r.kind} · {r.name}
              </strong>
              <span>
                羁绊 {r.bond}
                {r.kind === '仇敌' && r.revengeIn != null ? ` · 寻仇倒计时 ${r.revengeIn} 年` : ''}
                {r.note ? ` · ${r.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>武学列表</h3>
      {character.martialArts.length === 0 ? (
        <p className="muted">尚不会武，只凭蛮力。</p>
      ) : (
        <ul className="martial-list">
          {character.martialArts.map((m) => {
            const d = getMartial(m.id)
            return (
              <li key={m.id}>
                <strong>{d.name}</strong>
                <span>
                  {d.type} · {d.grade} · 第{m.level}层 · {m.learnedAt}岁得自{m.source}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <h3>称号列表</h3>
      {character.titles.length === 0 ? (
        <p className="muted">尚无江湖名号。</p>
      ) : (
        <ul className="title-list">
          {character.titles.map((t) => {
            const d = getTitle(t.id)
            const isPrimary = character.primaryTitleId === t.id
            return (
              <li key={t.id}>
                <div>
                  <strong>
                    {d.name}
                    {isPrimary ? '（主称号）' : ''}
                  </strong>
                  <span>
                    {t.gainedAt}岁 · {d.type} · {d.rarity} · {d.desc}
                  </span>
                </div>
                {!readOnly && !isPrimary && onSetPrimary && (
                  <button type="button" className="btn ghost tiny" onClick={() => onSetPrimary(t.id)}>
                    设为主称号
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
