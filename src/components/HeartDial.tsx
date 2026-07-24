import { useState } from 'react'
import type { HeartTier } from '../types'
import { HEART_TIERS, heartTier } from '../lib/utils'

const TIER_BLURB: Record<HeartTier, string> = {
  至善: '心怀苍生，行事多向正道靠拢。',
  偏正: '尚存侠义，偶亦计较得失。',
  中庸: '不偏不倚，随势而行。',
  偏邪: '心生戾气，易走偏锋。',
  极恶: '心魔深重，江湖闻之色变。',
}

/** 心性独立交互：点选档位查看说明，指针随数值滑动 */
export function HeartDial({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value))
  const current = heartTier(clamped)
  const [focus, setFocus] = useState<HeartTier>(current)
  const pct = ((clamped + 100) / 200) * 100

  return (
    <div className="heart-dial">
      <div className="heart-dial__head">
        <strong>心性</strong>
        <span className={`heart-dial__tier heart-dial__tier--${current}`}>
          {current} · {clamped > 0 ? `+${clamped}` : clamped}
        </span>
      </div>
      <div className="heart-dial__track" aria-hidden>
        <div className="heart-dial__spectrum" />
        <span className="heart-dial__needle" style={{ left: `${pct}%` }} />
      </div>
      <div className="heart-dial__ticks" role="tablist" aria-label="心性档位">
        {[...HEART_TIERS].reverse().map(({ tier }) => (
          <button
            key={tier}
            type="button"
            role="tab"
            aria-selected={focus === tier}
            className={`heart-dial__tick${focus === tier ? ' is-active' : ''}${current === tier ? ' is-current' : ''}`}
            onClick={() => setFocus(tier)}
          >
            {tier}
          </button>
        ))}
      </div>
      <p className="heart-dial__blurb">
        {focus === current ? (
          <>
            当前为<strong>{focus}</strong>：{TIER_BLURB[focus]}
          </>
        ) : (
          <>
            <strong>{focus}</strong>：{TIER_BLURB[focus]}
            <span className="muted">（点回「{current}」看当下）</span>
          </>
        )}
      </p>
    </div>
  )
}
