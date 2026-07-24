import {
  ACHIEVEMENTS,
  codexProgress,
  type CodexState,
} from '../lib/meta'
import { MARTIAL_ARTS } from '../data/martialArts'
import { TITLES } from '../data/titles'
import { BRAND } from '../lib/brand'

function rarityClass(r: string) {
  return r === '传说'
    ? 'rarity-legend'
    : r === '史诗'
      ? 'rarity-epic'
      : r === '稀有'
        ? 'rarity-rare'
        : 'rarity-common'
}

export function CodexScreen({
  codex,
  onBack,
}: {
  codex: CodexState
  onBack: () => void
}) {
  const progress = codexProgress(codex)
  const unlockedCount = codex.achievements.length

  return (
    <section className="panel codex-screen">
      <div className="codex-screen__head">
        <div>
          <p className="eyebrow">江湖簿册</p>
          <h1>{BRAND.codex}</h1>
          <p className="muted">走过的路，落成格子里的一枚枚印记。</p>
        </div>
        <button type="button" className="btn tiny" onClick={onBack}>
          {BRAND.home}
        </button>
      </div>

      <p className="meta codex-screen__progress">
        功业 {progress.achievements} · 武学 {progress.martialArts} · 称号 {progress.titles} · 结局标签{' '}
        {progress.endings}
      </p>

      <h2 className="codex-screen__section">
        功业收藏
        <span>
          {unlockedCount}/{ACHIEVEMENTS.length}
        </span>
      </h2>
      <ul className="codex-achieve-grid">
        {ACHIEVEMENTS.map((a) => {
          const on = codex.achievements.includes(a.id)
          return (
            <li
              key={a.id}
              className={`codex-achieve${on ? ' codex-achieve--on' : ' codex-achieve--off'}`}
              title={on ? a.desc : '尚未解锁'}
            >
              <strong>{a.name}</strong>
              <span>{on ? a.desc : '未激活'}</span>
            </li>
          )
        })}
      </ul>

      <h2 className="codex-screen__section">
        武学图鉴
        <span>
          {codex.martialArts.length}/{MARTIAL_ARTS.length}
        </span>
      </h2>
      <ul className="codex-grid">
        {MARTIAL_ARTS.map((m) => {
          const known = codex.martialArts.includes(m.id)
          const gradeRarity =
            m.grade === '神功' || m.grade === '绝学'
              ? '传说'
              : m.grade === '上乘'
                ? '史诗'
                : '普通'
          return (
            <li
              key={m.id}
              className={`codex-chip ${known ? rarityClass(gradeRarity) : 'codex-chip--locked'}`}
            >
              {known ? `${m.name}·${m.grade}` : '???'}
            </li>
          )
        })}
      </ul>

      <h2 className="codex-screen__section">
        称号图鉴
        <span>
          {codex.titles.length}/{TITLES.length}
        </span>
      </h2>
      <ul className="codex-grid">
        {TITLES.map((t) => {
          const known = codex.titles.includes(t.id)
          return (
            <li
              key={t.id}
              className={`codex-chip ${known ? rarityClass(t.rarity) : 'codex-chip--locked'}`}
            >
              {known ? t.name : '???'}
            </li>
          )
        })}
      </ul>

      <h2 className="codex-screen__section">
        结局标签
        <span>
          {codex.endings.length}/{progress.endingPool.length}
        </span>
      </h2>
      <ul className="codex-grid">
        {progress.endingPool.map((tag) => {
          const known = codex.endings.includes(tag)
          return (
            <li key={tag} className={`codex-chip ${known ? 'rarity-rare' : 'codex-chip--locked'}`}>
              {known ? tag : '???'}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
