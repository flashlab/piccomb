#!/usr/bin/env node
/**
 * Generate PicComb app icons as real PNGs with zero dependencies.
 * Draws a rounded-square brand tile with a 2x2 "collage grid" glyph:
 * three white cells + one amber accent cell (the highlighted photo).
 * Usage: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons')

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* ---------- PNG encode (RGBA, filter 0) ---------- */
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------- pixel helpers ---------- */
function makeCanvas(size) {
  return { size, buf: Buffer.alloc(size * size * 4) } // transparent
}
function blend(px, [r, g, b, a]) {
  const sa = a / 255
  const da = px[3] / 255
  const oa = sa + da * (1 - sa)
  if (oa === 0) { px[0] = px[1] = px[2] = px[3] = 0; return }
  px[0] = Math.round((r * sa + px[0] * da * (1 - sa)) / oa)
  px[1] = Math.round((g * sa + px[1] * da * (1 - sa)) / oa)
  px[2] = Math.round((b * sa + px[2] * da * (1 - sa)) / oa)
  px[3] = Math.round(oa * 255)
}
/** rounded-rect signed distance: <0 inside */
function rrSD(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}
function fillRoundRect(cv, x, y, w, h, r, color) {
  const { size, buf } = cv
  const cx = x + w / 2
  const cy = y + h / 2
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(size, Math.ceil(y + h)); py++) {
    for (let px = Math.max(0, Math.floor(x)); px < Math.min(size, Math.ceil(x + w)); px++) {
      const d = rrSD(px + 0.5, py + 0.5, cx, cy, w / 2, h / 2, r)
      if (d > 0.5) continue
      const coverage = d < -0.5 ? 255 : Math.round((0.5 - d) * 255)
      const off = (py * size + px) * 4
      blend(buf.subarray(off, off + 4), [color[0], color[1], color[2], Math.min(color[3], coverage)])
    }
  }
}

/* ---------- PicComb glyph ---------- */
const GRAPHITE = [24, 24, 27, 255] // brand tile
const WHITE = [255, 255, 255, 255]
const AMBER = [245, 158, 11, 255] // accent cell

function drawIcon(size) {
  const cv = makeCanvas(size)
  const pad = 0 // full-bleed tile (maskable-safe zone: glyph inside 80%)
  fillRoundRect(cv, pad, pad, size - pad * 2, size - pad * 2, size * 0.22, GRAPHITE)
  const gap = size * 0.045
  const area = size * 0.62 // glyph bounding box
  const cell = (area - gap) / 2
  const ox = (size - area) / 2
  const oy = (size - area) / 2
  const rr = cell * 0.24
  fillRoundRect(cv, ox, oy, cell, cell, rr, WHITE)
  fillRoundRect(cv, ox + cell + gap, oy, cell, cell, rr, WHITE)
  fillRoundRect(cv, ox, oy + cell + gap, cell, cell, rr, WHITE)
  fillRoundRect(cv, ox + cell + gap, oy + cell + gap, cell, cell, rr, AMBER)
  return encodePNG(size, size, cv.buf)
}

mkdirSync(OUT, { recursive: true })
for (const [name, size] of [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
]) {
  writeFileSync(join(OUT, name), drawIcon(size))
  console.log('wrote', name, size)
}
