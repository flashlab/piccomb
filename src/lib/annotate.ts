import { clamp } from '@/lib/geometry'

/* ================= annotation object model ================= */

export type ToolId = 'select' | 'rect' | 'ellipse' | 'arrow' | 'brush' | 'mosaic' | 'text' | 'emoji'
export type SizeLevel = 1 | 2 | 3

export interface Pt {
  x: number
  y: number
}

interface ShapeBase {
  id: number
  color: string
  level: SizeLevel
}

export interface RectShape extends ShapeBase {
  kind: 'rect' | 'ellipse'
  x: number
  y: number
  w: number
  h: number
  fill: boolean
}

export interface ArrowShape extends ShapeBase {
  kind: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface StrokeShape extends ShapeBase {
  kind: 'brush' | 'mosaic'
  points: Pt[]
  /** baked pixelated patch (mosaic only), natural-resolution */
  patch?: HTMLCanvasElement
  patchX?: number
  patchY?: number
}

export interface TextShape extends ShapeBase {
  kind: 'text'
  x: number
  y: number
  text: string
  /** measured bbox (natural px), filled at commit */
  w: number
  h: number
}

export interface EmojiShape extends ShapeBase {
  kind: 'emoji'
  x: number
  y: number
  /** unicode char or object URL for custom uploads */
  content: string
  isImage: boolean
  /** edge length, natural px — freely scalable */
  px: number
}

export type Shape = RectShape | ArrowShape | StrokeShape | TextShape | EmojiShape

/* ================= constants ================= */

/** 8-color palette, WeChat ordering */
export const PALETTE = [
  '#E5484D',
  '#F76B15',
  '#FFC53D',
  '#46A758',
  '#0090FF',
  '#8E4EC6',
  '#1A1A1A',
  '#FFFFFF',
] as const

export const BUILT_IN_EMOJI = [
  '😀', '😂', '🥹', '😍', '😎', '🤔', '😭', '😡',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '👌',
  '❤️', '💔', '⭐', '🔥', '🎉', '💯', '⚠️', '❓',
] as const

const STROKE_BASE: Record<SizeLevel, number> = { 1: 6, 2: 12, 3: 20 }
const MOSAIC_BASE: Record<SizeLevel, number> = { 1: 10, 2: 20, 3: 32 }
const TEXT_BASE: Record<SizeLevel, number> = { 1: 28, 2: 48, 3: 80 }

/** stroke/font px scale with image resolution so levels feel equal across sizes */
export const resScale = (natW: number): number => clamp(natW / 1500, 0.7, 3)
export const strokePx = (level: SizeLevel, natW: number): number => STROKE_BASE[level] * resScale(natW)
export const mosaicStrokePx = (level: SizeLevel, natW: number): number => MOSAIC_BASE[level] * resScale(natW)
export const textPx = (level: SizeLevel, natW: number): number => TEXT_BASE[level] * resScale(natW)
export const emojiDefaultPx = (natW: number): number => 96 * resScale(natW)
export const emojiRange = (natW: number): [number, number] => [24 * resScale(natW), 384 * resScale(natW)]

/** mosaic pixel block: tied to stroke width, never below 8 natural px */
export const mosaicBlockPx = (level: SizeLevel, natW: number): number =>
  Math.max(8, mosaicStrokePx(level, natW) / 3)

/** rounded-rect corner radius: follows stroke weight, capped at a quarter of the short edge */
export const rectRadius = (w: number, h: number, lw: number): number =>
  clamp(2 * lw, 0, Math.min(Math.abs(w), Math.abs(h)) / 4)

/* ================= pure geometry (unit-tested) ================= */

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1)
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

export function distToPolyline(px: number, py: number, points: Pt[]): number {
  if (points.length === 0) return Infinity
  if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y)
  let d = Infinity
  for (let i = 1; i < points.length; i++) {
    d = Math.min(d, distToSegment(px, py, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y))
  }
  return d
}

/** arrow head wing endpoints: length ∝ stroke width, 25° spread */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, lw: number): [Pt, Pt] {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const len = 3.2 * lw
  const spread = (25 * Math.PI) / 180
  return [
    { x: x2 - len * Math.cos(angle - spread), y: y2 - len * Math.sin(angle - spread) },
    { x: x2 - len * Math.cos(angle + spread), y: y2 - len * Math.sin(angle + spread) },
  ]
}

/** stroke bbox expanded by half the stroke width (natural px) */
export function strokeBBox(points: Pt[], halfW: number): { x: number; y: number; w: number; h: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX - halfW, y: minY - halfW, w: maxX - minX + 2 * halfW, h: maxY - minY + 2 * halfW }
}

/** hit-test in natural px. Mosaic is deliberately NOT selectable/movable —
 *  its patch carries baked pixels; moving it would expose the original. */
export function hitTest(shape: Shape, px: number, py: number, natW: number): boolean {
  const tol = strokePx(shape.level, natW) / 2 + 6
  switch (shape.kind) {
    case 'rect':
    case 'ellipse': {
      // bbox grab: users expect to drag an outline shape from its interior
      // too, not only by its border
      return px >= shape.x - tol && px <= shape.x + shape.w + tol && py >= shape.y - tol && py <= shape.y + shape.h + tol
    }
    case 'arrow':
      return distToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2) <= tol
    case 'brush':
      return distToPolyline(px, py, shape.points) <= tol
    case 'mosaic':
      return false
    case 'text':
      return px >= shape.x - tol && px <= shape.x + shape.w + tol && py >= shape.y - tol && py <= shape.y + shape.h + tol
    case 'emoji':
      return (
        px >= shape.x - shape.px / 2 - tol &&
        px <= shape.x + shape.px / 2 + tol &&
        py >= shape.y - shape.px / 2 - tol &&
        py <= shape.y + shape.px / 2 + tol
      )
  }
}

/** pure translation: returns a NEW shape (safe inside React state updaters) */
export function translated(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.kind) {
    case 'rect':
    case 'ellipse':
      return { ...shape, x: shape.x + dx, y: shape.y + dy }
    case 'arrow':
      return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy }
    case 'brush':
    case 'mosaic':
      return {
        ...shape,
        points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        patchX: shape.patchX !== undefined ? shape.patchX + dx : undefined,
        patchY: shape.patchY !== undefined ? shape.patchY + dy : undefined,
      }
    case 'text':
    case 'emoji':
      return { ...shape, x: shape.x + dx, y: shape.y + dy }
  }
}

export function bboxOf(shape: Shape, natW: number): { x: number; y: number; w: number; h: number } {
  switch (shape.kind) {
    case 'rect':
    case 'ellipse':
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
    case 'arrow': {
      const pad = strokePx(shape.level, natW) * 2
      return {
        x: Math.min(shape.x1, shape.x2) - pad,
        y: Math.min(shape.y1, shape.y2) - pad,
        w: Math.abs(shape.x2 - shape.x1) + 2 * pad,
        h: Math.abs(shape.y2 - shape.y1) + 2 * pad,
      }
    }
    case 'brush':
    case 'mosaic':
      return strokeBBox(
        shape.points,
        (shape.kind === 'mosaic' ? mosaicStrokePx(shape.level, natW) : strokePx(shape.level, natW)) / 2,
      )
    case 'text':
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
    case 'emoji':
      return { x: shape.x - shape.px / 2, y: shape.y - shape.px / 2, w: shape.px, h: shape.px }
  }
}

/* ================= canvas rendering ================= */

export function drawShape(ctx: CanvasRenderingContext2D, s: Shape, natW: number): void {
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const lw = strokePx(s.level, natW)
  switch (s.kind) {
    case 'rect': {
      ctx.lineWidth = lw
      const r = rectRadius(s.w, s.h, lw)
      ctx.beginPath()
      ctx.roundRect(s.x, s.y, s.w, s.h, r)
      if (s.fill) ctx.fill()
      else ctx.stroke()
      break
    }
    case 'ellipse':
      ctx.lineWidth = lw
      ctx.beginPath()
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2)
      if (s.fill) ctx.fill()
      else ctx.stroke()
      break
    case 'arrow': {
      ctx.lineWidth = lw
      const [w1, w2] = arrowHead(s.x1, s.y1, s.x2, s.y2, lw)
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x2, s.y2)
      ctx.moveTo(s.x2, s.y2)
      ctx.lineTo(w1.x, w1.y)
      ctx.moveTo(s.x2, s.y2)
      ctx.lineTo(w2.x, w2.y)
      ctx.stroke()
      break
    }
    case 'brush':
      if (s.points.length === 0) break
      ctx.lineWidth = lw
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.01, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      ctx.stroke()
      break
    case 'mosaic':
      if (s.patch && s.patchX !== undefined && s.patchY !== undefined) {
        ctx.drawImage(s.patch, s.patchX, s.patchY)
      }
      break
    case 'text':
      ctx.font = `600 ${textPx(s.level, natW)}px system-ui, -apple-system, "Segoe UI", sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText(s.text, s.x, s.y)
      break
    case 'emoji':
      if (s.isImage) {
        const img = emojiImageCache.get(s.content)
        if (img) ctx.drawImage(img, s.x - s.px / 2, s.y - s.px / 2, s.px, s.px)
      } else {
        ctx.font = `${s.px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.content, s.x, s.y)
      }
      break
  }
  ctx.restore()
}

/* ================= mosaic baking ================= */

/**
 * Pixelate the region under a mosaic stroke. The patch is masked to the
 * stroke itself so only the drawn path gets pixelated.
 */
export function bakeMosaicPatch(img: CanvasImageSource, natW: number, natH: number, s: StrokeShape): void {
  const halfW = mosaicStrokePx(s.level, natW) / 2
  const bb = strokeBBox(s.points, halfW)
  const x = Math.max(0, Math.floor(bb.x))
  const y = Math.max(0, Math.floor(bb.y))
  const w = Math.min(natW - x, Math.ceil(bb.w))
  const h = Math.min(natH - y, Math.ceil(bb.h))
  if (w <= 0 || h <= 0) return

  const block = mosaicBlockPx(s.level, natW)
  const patch = document.createElement('canvas')
  patch.width = w
  patch.height = h
  const ctx = patch.getContext('2d')!
  // downscale → upscale without smoothing = pixelation
  const smallW = Math.max(1, Math.round(w / block))
  const smallH = Math.max(1, Math.round(h / block))
  const small = document.createElement('canvas')
  small.width = smallW
  small.height = smallH
  const sctx = small.getContext('2d')!
  sctx.drawImage(img, x, y, w, h, 0, 0, smallW, smallH)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, w, h)
  // mask to the stroke path
  ctx.globalCompositeOperation = 'destination-in'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = halfW * 2
  ctx.strokeStyle = '#000'
  ctx.beginPath()
  s.points.forEach((p, i) => {
    const lx = p.x - x
    const ly = p.y - y
    if (i === 0) ctx.moveTo(lx, ly)
    else ctx.lineTo(lx, ly)
  })
  if (s.points.length === 1) ctx.lineTo(s.points[0].x - x + 0.01, s.points[0].y - y)
  ctx.stroke()

  s.patch = patch
  s.patchX = x
  s.patchY = y
}

/* ================= misc ================= */

/** custom emoji uploads decode once, then render from cache */
export const emojiImageCache = new Map<string, HTMLImageElement>()

export function measureText(text: string, level: SizeLevel, natW: number): { w: number; h: number } {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const px = textPx(level, natW)
  ctx.font = `600 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
  return { w: ctx.measureText(text).width, h: px * 1.25 }
}
