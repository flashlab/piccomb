# PicComb

[English](README.md) | [中文](README.zh-CN.md)

Free online collage maker — layout collage · image split · image crop · image editor (WeChat-style annotations). All processing happens locally in your browser. No watermark, no sign-up.

![PicComb screenshot](docs/screenshot.jpg)

**Stack**: Vite + React + TypeScript + shadcn/ui (Base UI) + Tailwind CSS v4 · react-i18next (中文/日本語/English) · PWA

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest, pure-logic suites
npm run build      # outputs to dist/
```

## Deployment

Hosted on **Cloudflare Pages** (Git-connected, auto-builds on push):

- Build command: `npm run build`
- Build output: `dist`
- SPA fallback via `public/_redirects` (`/* /index.html 200`)
- Custom domain `picomb.openwebui.de` is attached in the Pages project (DNS already on Cloudflare)

## Icons

`node scripts/gen-icons.mjs` regenerates `public/icons/` (zero-dependency plain Node; edit the constants at the top of the script to recolor).

## Architecture notes

- `src/data/templates.json` — 135 layout templates (1–16 images), format `{g, gr:[rows,cols], c:[{r,c,s?}]}`; `s` is an optional 1-indexed pinned cell
- `src/lib/templates.ts` — template placement (two-pass: pinned first, then first-fit), smart matching, divider-drag math
- `src/lib/geometry.ts` — cover-fit / pan-zoom / source-rect math shared by the edit view and the exporter
- `src/lib/export.ts` — canvas export pipeline (collage render, split, rotated crop, format/quality/filename)
- `src/lib/annotate.ts` — annotation object model for the editor: rect/ellipse/arrow/brush/mosaic/text/emoji rendering, hit-testing, mosaic patch baking
- Edit view is DOM (grid span + overflow hidden + CSS transform); export re-renders on an offscreen 2D canvas at any resolution. The editor module uses an object model + dual canvas (committed layer + live draft layer)

## Contributors

- [zzbd - LINUX DO](https://linux.do/u/zzbd/summary)
