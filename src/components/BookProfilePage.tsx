import type { Character, Rarity } from '../types'
import { calcForce, getMartial, getTitle, getTrait } from '../engine/simulator'
import { HexAttrRadar } from './HexAttrRadar'
import { HeartDial } from './HeartDial'

export type ProfileSection = 'attrs' | 'bonds' | 'arts'

function rarityClass(r: string) {
  return r === '传说'
    ? 'rarity-legend'
    : r === '史诗'
      ? 'rarity-epic'
      : r === '稀有'
        ? 'rarity-rare'
        : 'rarity-common'
}

function martialRarity(grade: string): Rarity {
  if (grade === '神功' || grade === '绝学') return '传说'
  if (grade === '上乘') return '史诗'
  if (grade === '中乘') return '稀有'
  return '普通'
}

export function BookProfilePage({
  character,
  section,
}: {
  character: Character
  section: ProfileSection
}) {
  if (section === 'attrs') {
    return (
      <div className="book-profile book-profile--attrs">
        <h3 className="book-profile__section">
          六维与心性
          <span>
            {character.realm} · 战力 {calcForce(character)}
          </span>
        </h3>
        <p className="meta">寿元上限 {character.lifespan} · 正道 {character.fameGood} · 邪道 {character.fameEvil} · 财富 {character.wealth}</p>
        <div className="attr-duo">
          <HexAttrRadar attrs={character.attrs} size={200} />
          <HeartDial value={character.attrs.心性} />
        </div>
      </div>
    )
  }

  if (section === 'bonds') {
    return (
      <div className="book-profile book-profile--bonds">
        <h3 className="book-profile__section">
          天赋
          <span>
            {character.traitIds.length} 枚
          </span>
        </h3>
        {character.traitIds.length === 0 ? (
          <p className="muted">此生未点醒天赋。</p>
        ) : (
          <ul className="codex-achieve-grid book-profile__grid">
            {character.traitIds.map((id) => {
              const t = getTrait(id)
              return (
                <li
                  key={id}
                  className={`codex-achieve codex-achieve--on ${rarityClass(t.rarity)}`}
                  title={t.desc}
                >
                  <strong>{t.name}</strong>
                  <em className="book-profile__tag">{t.rarity}</em>
                  <span>{t.desc}</span>
                </li>
              )
            })}
          </ul>
        )}

        <h3 className="book-profile__section">
          人际关系
          <span>
            {character.relations.length} 人
          </span>
        </h3>
        {character.relations.length === 0 ? (
          <p className="muted">尚无固定人事牵绊。</p>
        ) : (
          <ul className="codex-achieve-grid book-profile__grid">
            {character.relations.map((r) => (
              <li
                key={`${r.kind}-${r.name}`}
                className={`codex-achieve codex-achieve--on book-profile__relation book-profile__relation--${r.kind}`}
              >
                <strong>
                  {r.kind} · {r.name}
                </strong>
                <em className="book-profile__tag">羁绊 {r.bond}</em>
                <span>
                  {r.kind === '仇敌' && r.revengeIn != null ? `寻仇倒计时 ${r.revengeIn} 年` : ''}
                  {r.note ? `${r.kind === '仇敌' && r.revengeIn != null ? ' · ' : ''}${r.note}` : ''}
                  {!(r.note || (r.kind === '仇敌' && r.revengeIn != null)) ? '江湖牵绊，一字难尽。' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="book-profile book-profile--arts">
      <h3 className="book-profile__section">
        武学列表
        <span>
          {character.martialArts.length} 门
        </span>
      </h3>
      {character.martialArts.length === 0 ? (
        <p className="muted">尚不会武，只凭蛮力。</p>
      ) : (
        <ul className="codex-achieve-grid book-profile__grid">
          {character.martialArts.map((m) => {
            const d = getMartial(m.id)
            const gradeR = martialRarity(d.grade)
            return (
              <li
                key={m.id}
                className={`codex-achieve codex-achieve--on ${rarityClass(gradeR)}`}
                title={`${d.type} · ${d.grade}`}
              >
                <strong>{d.name}</strong>
                <em className="book-profile__tag">
                  {d.grade} · 第{m.level}层
                </em>
                <span>
                  {d.type} · {m.learnedAt}岁得自{m.source}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <h3 className="book-profile__section">
        称号
        <span>
          {character.titles.length} 枚
        </span>
      </h3>
      {character.titles.length === 0 ? (
        <p className="muted">尚无江湖名号。</p>
      ) : (
        <ul className="codex-achieve-grid book-profile__grid">
          {character.titles.map((t) => {
            const d = getTitle(t.id)
            const isPrimary = character.primaryTitleId === t.id
            return (
              <li
                key={t.id}
                className={`codex-achieve codex-achieve--on ${rarityClass(d.rarity)}${isPrimary ? ' book-profile__primary' : ''}`}
                title={d.desc}
              >
                <strong>
                  {d.name}
                  {isPrimary ? ' · 主' : ''}
                </strong>
                <em className="book-profile__tag">
                  {d.rarity} · {d.type}
                </em>
                <span>
                  {t.gainedAt}岁获得 · {d.desc}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
