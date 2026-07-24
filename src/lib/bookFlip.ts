/** 翻页手势纯函数 */

export const FLIP_DRAG_THRESHOLD_PX = 56
export const EDGE_ZONE_RATIO = 0.15

export function dragFlipIntent(dx: number, threshold = FLIP_DRAG_THRESHOLD_PX): 'next' | 'prev' | null {
  if (dx <= -threshold) return 'next'
  if (dx >= threshold) return 'prev'
  return null
}

/** 点击落在舞台左侧/右侧热区 */
export function edgeFlipIntent(
  clientX: number,
  stageLeft: number,
  stageWidth: number,
  ratio = EDGE_ZONE_RATIO,
): 'next' | 'prev' | null {
  if (stageWidth <= 0) return null
  const x = clientX - stageLeft
  const edge = stageWidth * ratio
  if (x <= edge) return 'prev'
  if (x >= stageWidth - edge) return 'next'
  return null
}

export function shouldUseDualSpread(viewportWidth: number, minWidth = 900): boolean {
  return viewportWidth >= minWidth
}
