export interface Size {
  w: number
  h: number
}

/**
 * Per-cell image transform: `scale` is a multiplier on top of cover-fit
 * (1 = exactly cover the cell), `x`/`y` are pan offsets in cell-display px,
 * `rotation` is quarter-turns clockwise (0/90/180/270).
 */
export interface ImageTransform {
  scale: number
  x: number
  y: number
  rotation: number
}

export const IDENTITY_TRANSFORM: ImageTransform = { scale: 1, x: 0, y: 0, rotation: 0 }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/* ---------- non-linear rotation slider mapping ---------- */

const ROT_CURVE_A = 0.8
const SNAPS = [-90, -45, 0, 45, 90]
const SNAP_WINDOW = 1.2

const rotCurve = (s: number): number => s - (ROT_CURVE_A * Math.sin(4 * Math.PI * s)) / (4 * Math.PI)

/**
 * Slider position s∈[0,1] → angle∈[-90,90]. Cosine-modulated: fine steps
 * near the center and both ends, fast in between; snaps to 0/±45/±90.
 */
export function sliderToAngle(s: number): number {
  let deg = -90 + 180 * rotCurve(clamp(s, 0, 1))
  for (const snap of SNAPS) {
    if (Math.abs(deg - snap) < SNAP_WINDOW) {
      deg = snap
      break
    }
  }
  return Math.round(deg * 10) / 10
}

/** inverse of sliderToAngle (bisection; the curve is strictly monotonic) */
export function angleToSlider(deg: number): number {
  const target = clamp((deg + 90) / 180, 0, 1)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (rotCurve(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** effective bitmap dims after rotation (90/270 swap w/h) */
export function rotatedSize(img: Size, rotation: number): Size {
  return rotation % 180 === 0 ? img : { w: img.h, h: img.w }
}

/** scale factor so the (possibly rotated) image exactly covers the cell */
export function coverScale(img: Size, cell: Size, rotation = 0): number {
  const e = rotatedSize(img, rotation)
  return Math.max(cell.w / e.w, cell.h / e.h)
}

/** displayed size of the rotated image in cell-display px */
export function displayedSize(t: ImageTransform, img: Size, cell: Size): Size {
  const e = rotatedSize(img, t.rotation)
  const base = coverScale(img, cell, t.rotation)
  return { w: e.w * base * t.scale, h: e.h * base * t.scale }
}

/** clamp pan so the rotated image always fully covers the cell */
export function clampPan(t: ImageTransform, img: Size, cell: Size): ImageTransform {
  const d = displayedSize(t, img, cell)
  const maxX = Math.max(0, (d.w - cell.w) / 2)
  const maxY = Math.max(0, (d.h - cell.h) / 2)
  return {
    scale: clamp(t.scale, MIN_ZOOM, MAX_ZOOM),
    x: clamp(t.x, -maxX, maxX),
    y: clamp(t.y, -maxY, maxY),
    rotation: ((t.rotation % 360) + 360) % 360,
  }
}

export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * The region of the drawable bitmap (in its own pixels) visible inside the
 * cell. `bmp` must be the dims of the bitmap actually handed to drawImage —
 * i.e. already-rotated when the cell is rotated — so this function needs no
 * rotation knowledge.
 */
export function sourceRect(t: ImageTransform, bmp: Size, cell: Size): SourceRect {
  const base = Math.max(cell.w / bmp.w, cell.h / bmp.h)
  const d = { w: bmp.w * base * t.scale, h: bmp.h * base * t.scale }
  const x0 = (cell.w - d.w) / 2 + t.x
  const y0 = (cell.h - d.h) / 2 + t.y
  return {
    sx: clamp((-x0 / d.w) * bmp.w, 0, bmp.w),
    sy: clamp((-y0 / d.h) * bmp.h, 0, bmp.h),
    sw: clamp((cell.w / d.w) * bmp.w, 0, bmp.w),
    sh: clamp((cell.h / d.h) * bmp.h, 0, bmp.h),
  }
}

/**
 * Pixel-space rectangles for every cell of a template inside an output box.
 * Fractions define row heights / col widths; cells are inset by spacing/2.
 */
export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

export function cellRect(
  placement: { row: number; col: number; rowSpan: number; colSpan: number },
  rowFracs: number[],
  colFracs: number[],
  box: PixelRect,
  spacing: number,
): PixelRect {
  const colStart = colFracs.slice(0, placement.col).reduce((a, b) => a + b, 0)
  const colSpan = colFracs
    .slice(placement.col, placement.col + placement.colSpan)
    .reduce((a, b) => a + b, 0)
  const rowStart = rowFracs.slice(0, placement.row).reduce((a, b) => a + b, 0)
  const rowSpan = rowFracs
    .slice(placement.row, placement.row + placement.rowSpan)
    .reduce((a, b) => a + b, 0)
  const half = spacing / 2
  return {
    x: box.x + colStart * box.w + half,
    y: box.y + rowStart * box.h + half,
    w: Math.max(0, colSpan * box.w - spacing),
    h: Math.max(0, rowSpan * box.h - spacing),
  }
}
