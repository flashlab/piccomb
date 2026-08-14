import { inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const buf = readFileSync(process.argv[2] ?? 'public/icons/icon-192.png')
let off = 8
const idat = []
let w = 0
let h = 0
while (off < buf.length) {
  const len = buf.readUInt32BE(off)
  const type = buf.toString('ascii', off + 4, off + 8)
  const data = buf.subarray(off + 8, off + 8 + len)
  if (type === 'IHDR') {
    w = data.readUInt32BE(0)
    h = data.readUInt32BE(4)
  }
  if (type === 'IDAT') idat.push(data)
  off += 12 + len
}
const raw = inflateSync(Buffer.concat(idat))
const stride = w * 4 + 1
for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 24))) {
  let line = ''
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 48))) {
    const o = y * stride + 1 + x * 4
    const r = raw[o]
    const g = raw[o + 1]
    const a = raw[o + 3]
    line += a < 60 ? ' ' : r > 240 && g > 240 ? 'W' : r > 200 ? 'A' : '#'
  }
  console.log(line)
}
