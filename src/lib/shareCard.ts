import type { EndingReport } from '../types'
import { heartTier } from './utils'
import { ORIGINS } from '../data/origins'
import { TITLES } from '../data/titles'
import { primaryDeathTag } from './deathTags'

function originName(id: string) {
  return ORIGINS.find((o) => o.id === id)?.name ?? id
}

function titleName(id: string) {
  return TITLES.find((t) => t.id === id)?.name ?? id
}

/** 生成结算分享图（canvas） */
export function renderShareCard(ending: EndingReport, seed?: number): HTMLCanvasElement {
  const w = 720
  const h = 960
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const c = ending.character
  const primary = c.primaryTitleId ? titleName(c.primaryTitleId) : null
  const deathTag = primaryDeathTag(ending.deathReason, c)

  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#f3ebe0')
  g.addColorStop(0.55, '#e8dcc8')
  g.addColorStop(1, '#d9cbb3')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(52, 42, 32, 0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, w - 56, h - 56)
  ctx.strokeStyle = 'rgba(52, 42, 32, 0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(40, 40, w - 80, h - 80)

  ctx.fillStyle = '#3a2f24'
  ctx.font = '26px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  ctx.fillText('武侠人生模拟器', 64, 88)

  ctx.fillStyle = '#9c2f1a'
  ctx.font = '28px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  ctx.fillText(deathTag, 64, 140)

  ctx.fillStyle = '#3a2f24'
  ctx.font = '36px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  const deathLine = ending.deathReason.slice(0, 18)
  ctx.fillText(deathLine, 64, 188)

  ctx.font = '40px "ZCOOL XiaoWei", "Songti SC", "Noto Serif SC", serif'
  const nameLine = primary ? `${c.name} · ${primary}` : c.name
  ctx.fillText(nameLine.slice(0, 14), 64, 250)

  ctx.font = '22px "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif'
  ctx.fillStyle = '#5c4e3f'
  ctx.fillText(`主线「${ending.mainline}」`, 64, 300)
  ctx.fillText(
    `出身${originName(c.originId)} · 【${c.realm}】 · ${ending.finalAge}岁`,
    64,
    338,
  )
  ctx.fillText(`心性 ${heartTier(c.attrs.心性)} · 评分 ${ending.score}`, 64, 376)
  if (seed != null) {
    ctx.fillStyle = '#8a735a'
    ctx.font = '20px "Source Han Serif SC", "Songti SC", serif'
    ctx.fillText(`种子 ${seed} · 同种不同抉择`, 64, 414)
  }

  ctx.fillStyle = '#3a2f24'
  ctx.font = '20px "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif'
  wrapText(ctx, ending.summary, 64, 460, w - 128, 30, 4)

  const highs = ending.highlights.slice(0, 2)
  if (highs.length) {
    ctx.font = '22px "ZCOOL XiaoWei", serif'
    ctx.fillText('高光', 64, 620)
    ctx.font = '20px "Source Han Serif SC", "Songti SC", serif'
    ctx.fillStyle = '#5c4e3f'
    highs.forEach((hLine, i) => {
      ctx.fillText(`· ${hLine}`, 64, 658 + i * 34)
    })
  }

  const rel =
    c.relations.length > 0
      ? `人事：${c.relations
          .slice(0, 2)
          .map((r) => `${r.kind}${r.name}`)
          .join('、')}`
      : ''
  if (rel) {
    ctx.fillStyle = '#5c4e3f'
    ctx.font = '18px "Source Han Serif SC", "Songti SC", serif'
    ctx.fillText(rel, 64, 740)
  }

  ctx.fillStyle = '#7a6a58'
  ctx.font = '18px "Source Han Serif SC", "Songti SC", serif'
  const extraTags = ending.endingTags.filter((t) => t !== deathTag).slice(0, 2)
  const tagLine = [deathTag, ...extraTags].join(' · ')
  ctx.fillText(`结局：${tagLine}`, 64, h - 72)
  ctx.fillText('同种子，不同抉择，亦是不同江湖。', 64, h - 44)

  return canvas
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = [...text]
  let line = ''
  let lineCount = 0
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight)
      line = ch
      lineCount += 1
      if (lineCount >= maxLines) {
        ctx.fillText(line.slice(0, -1) + '…', x, y + (lineCount - 1) * lineHeight)
        return
      }
    } else {
      line = test
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y + lineCount * lineHeight)
}

export function downloadShareCard(ending: EndingReport, seed?: number) {
  const canvas = renderShareCard(ending, seed)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `武侠人生-${ending.character.name}.png`
  a.click()
}
