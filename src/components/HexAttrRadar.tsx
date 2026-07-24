import type { CharacterAttrs } from '../types'

/** 六维雷达（不含心性） */
export const HEX_ATTR_KEYS = ['根骨', '悟性', '福缘', '魅力', '体魄', '机缘'] as const
export type HexAttrKey = (typeof HEX_ATTR_KEYS)[number]

const MAX = 100

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ringPoints(cx: number, cy: number, r: number) {
  return HEX_ATTR_KEYS.map((_, i) => {
    const p = polar(cx, cy, r, (360 / HEX_ATTR_KEYS.length) * i)
    return `${p.x},${p.y}`
  }).join(' ')
}

export function HexAttrRadar({
  attrs,
  size = 220,
}: {
  attrs: CharacterAttrs
  size?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.34
  const values = HEX_ATTR_KEYS.map((k) => Math.max(0, Math.min(MAX, attrs[k])) / MAX)
  const valuePts = HEX_ATTR_KEYS.map((_, i) => {
    const p = polar(cx, cy, radius * values[i], (360 / HEX_ATTR_KEYS.length) * i)
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <div className="hex-radar" style={{ width: size, maxWidth: '100%' }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="六维属性">
        {[0.33, 0.66, 1].map((t) => (
          <polygon
            key={t}
            className="hex-radar__grid"
            points={ringPoints(cx, cy, radius * t)}
            fill="none"
          />
        ))}
        {HEX_ATTR_KEYS.map((_, i) => {
          const p = polar(cx, cy, radius, (360 / HEX_ATTR_KEYS.length) * i)
          return <line key={i} className="hex-radar__axis" x1={cx} y1={cy} x2={p.x} y2={p.y} />
        })}
        <polygon className="hex-radar__fill" points={valuePts} />
        <polygon className="hex-radar__stroke" points={valuePts} fill="none" />
        {HEX_ATTR_KEYS.map((k, i) => {
          const labelR = radius + size * 0.12
          const p = polar(cx, cy, labelR, (360 / HEX_ATTR_KEYS.length) * i)
          const v = Math.round(attrs[k])
          return (
            <text key={k} className="hex-radar__label" x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle">
              <tspan x={p.x} dy="-0.35em">
                {k}
              </tspan>
              <tspan className="hex-radar__value" x={p.x} dy="1.15em">
                {v}
              </tspan>
            </text>
          )
        })}
      </svg>
    </div>
  )
}
