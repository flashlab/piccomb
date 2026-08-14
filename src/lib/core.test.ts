import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGES,
  dragDivider,
  matchTemplate,
  placeCells,
  templates,
  templatesForCount,
  uniformFractions,
} from '@/lib/templates'
import { clampPan, coverScale, displayedSize, sourceRect, sliderToAngle, angleToSlider } from '@/lib/geometry'
import { timestampName, cornerRadiusPx } from '@/lib/export'

describe('template data', () => {
  it('has 135 templates covering 1..16 images', () => {
    expect(templates).toHaveLength(135)
    expect(MAX_IMAGES).toBe(16)
    for (let n = 1; n <= 16; n++) expect(templatesForCount(n).length).toBeGreaterThan(0)
  })

  it('every template places all cells without overlap', () => {
    for (const t of templates) {
      const ps = placeCells(t)
      expect(ps).toHaveLength(t.count)
      const grid = Array.from({ length: t.rows }, () => Array(t.cols).fill(false))
      for (const p of ps) {
        for (let r = p.row; r < p.row + p.rowSpan; r++)
          for (let c = p.col; c < p.col + p.colSpan; c++) {
            expect(grid[r][c], `${t.id} overlap at ${r},${c}`).toBe(false)
            grid[r][c] = true
          }
      }
      // full coverage
      for (const row of grid) for (const cell of row) expect(cell, `${t.id} not full`).toBe(true)
    }
  })

  it('3-t1b2 places wide cell on top', () => {
    const t = templates.find((t) => t.id === '3-t1b2')!
    const ps = placeCells(t)
    expect(ps[0]).toEqual({ row: 0, col: 0, rowSpan: 1, colSpan: 2 })
    expect(ps[1]).toEqual({ row: 1, col: 0, rowSpan: 1, colSpan: 1 })
    expect(ps[2]).toEqual({ row: 1, col: 1, rowSpan: 1, colSpan: 1 })
  })
})

describe('matchTemplate (smart auto-layout)', () => {
  it('keeps current template when count matches', () => {
    const t = matchTemplate(3, '3-t1b2')
    expect(t.id).toBe('3-t1b2')
  })
  it('switches to first template of the new count', () => {
    const t = matchTemplate(4, '3-t1b2')
    expect(t.count).toBe(4)
    expect(t.id).toBe(templatesForCount(4)[0].id)
  })
  it('clamps beyond-range counts', () => {
    expect(matchTemplate(99, null).count).toBe(16)
    expect(matchTemplate(0, null).count).toBe(1)
  })
})

describe('uniformFractions / dragDivider', () => {
  it('uniform fractions sum to 1', () => {
    expect(uniformFractions(3).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
  it('drag redistributes between adjacent segments', () => {
    const f = dragDivider([1 / 3, 1 / 3, 1 / 3], 0, 0.1)
    expect(f[0]).toBeCloseTo(1 / 3 + 0.1)
    expect(f[1]).toBeCloseTo(1 / 3 - 0.1)
    expect(f[2]).toBeCloseTo(1 / 3)
  })
  it('respects min fraction', () => {
    const f = dragDivider([0.5, 0.5], 0, -0.49, 0.05)
    expect(f[0]).toBeCloseTo(0.05)
    expect(f[1]).toBeCloseTo(0.95)
  })
})

describe('cover geometry', () => {
  const img = { w: 1000, h: 500 } // landscape
  const cell = { w: 100, h: 100 } // square cell

  it('coverScale picks the larger ratio', () => {
    expect(coverScale(img, cell)).toBeCloseTo(0.2) // 100/500
  })

  it('identity transform crops sides symmetrically', () => {
    const s = sourceRect({ scale: 1, x: 0, y: 0, rotation: 0 }, img, cell)
    expect(s.sy).toBeCloseTo(0)
    expect(s.sh).toBeCloseTo(500)
    expect(s.sw).toBeCloseTo(500) // square crop from the middle
    expect(s.sx).toBeCloseTo(250)
  })

  it('pan shifts the source window and clamps at edges', () => {
    // dragging the image left (negative x) reveals the image's right edge
    const t = clampPan({ scale: 1, x: -9999, y: 0, rotation: 0 }, img, cell)
    const s = sourceRect(t, img, cell)
    expect(s.sx + s.sw).toBeLessThanOrEqual(img.w + 1e-6)
    expect(s.sx).toBeCloseTo(500) // right edge visible
  })

  it('zoom 2x quarters the visible source area', () => {
    const s = sourceRect({ scale: 2, x: 0, y: 0, rotation: 0 }, img, cell)
    expect(s.sw).toBeCloseTo(250)
    expect(s.sh).toBeCloseTo(250)
  })

  it('rotation swaps effective dims for cover-fit', () => {
    // landscape image rotated 90°: effective dims 500×1000, cover needs 0.2
    expect(coverScale(img, cell, 90)).toBeCloseTo(0.2)
    const d = displayedSize({ scale: 1, x: 0, y: 0, rotation: 90 }, img, cell)
    expect(d.w).toBeCloseTo(100)
    expect(d.h).toBeCloseTo(200)
    // the exported bitmap is pre-rotated, so sourceRect sees swapped dims
    const s = sourceRect({ scale: 1, x: 0, y: 0, rotation: 90 }, { w: 500, h: 1000 }, cell)
    expect(s.sw).toBeCloseTo(500)
    expect(s.sh).toBeCloseTo(500)
    expect(s.sx).toBeCloseTo(0)
    expect(s.sy).toBeCloseTo(250)
  })
})

describe('timestampName', () => {
  it('formats tool, stamp and extension', () => {
    const d = new Date(2026, 7, 14, 15, 30, 12)
    expect(timestampName('collage', 'png', d)).toBe('piccomb_collage_20260814-153012.png')
    expect(timestampName('split', 'jpeg', d)).toBe('piccomb_split_20260814-153012.jpg')
  })
})

describe('cornerRadiusPx', () => {
  it('100% of a square is a full circle', () => {
    expect(cornerRadiusPx(100, { w: 800, h: 800 })).toBeCloseTo(400)
  })
  it('uses the shorter edge', () => {
    expect(cornerRadiusPx(100, { w: 1200, h: 800 })).toBeCloseTo(400)
    expect(cornerRadiusPx(50, { w: 1200, h: 800 })).toBeCloseTo(200)
  })
  it('clamps out-of-range input', () => {
    expect(cornerRadiusPx(0, { w: 800, h: 800 })).toBe(0)
    expect(cornerRadiusPx(999, { w: 800, h: 800 })).toBeCloseTo(400)
  })
})

describe('non-linear rotation slider', () => {
  it('maps endpoints and center exactly', () => {
    expect(sliderToAngle(0)).toBe(-90)
    expect(sliderToAngle(1)).toBe(90)
    expect(sliderToAngle(0.5)).toBe(0)
  })
  it('is monotonic increasing', () => {
    let prev = -Infinity
    for (let i = 0; i <= 200; i++) {
      const v = sliderToAngle(i / 200)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('has finer granularity near center and ends than mid-quarters', () => {
    const d = (a: number, b: number) => Math.abs(sliderToAngle(b) - sliderToAngle(a))
    const nearCenter = d(0.5, 0.51)
    const nearEnd = d(0.99, 1)
    const midQuarter = d(0.25, 0.26)
    expect(nearCenter).toBeLessThan(midQuarter)
    expect(nearEnd).toBeLessThan(midQuarter)
  })
  it('inverse round-trips (unsnapped angles)', () => {
    for (const deg of [-73.4, -20.5, 12.3, 66.6]) {
      expect(sliderToAngle(angleToSlider(deg))).toBeCloseTo(deg, 0)
    }
  })
})
