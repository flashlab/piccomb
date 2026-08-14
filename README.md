# PicComb

免费在线拼图工具 —— 布局拼图 · 图片分割 · 图片裁剪。纯浏览器本地处理，无水印免登录。

**Stack**: Vite + React + TypeScript + shadcn/ui (Base UI) + Tailwind CSS v4 · react-i18next (中/日/英) · PWA

## 开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest 纯逻辑测试
npm run build      # 产物到 dist/
```

## 部署

托管在 **Cloudflare Pages**（连接 GitHub 仓库自动构建）：

- Build command: `npm run build`
- Build output: `dist`
- SPA fallback 由 `public/_redirects` 提供（`/* /index.html 200`）
- 自定义域名 `picomb.fuclau.de` 在 Pages 项目里添加即可（fuclau.de DNS 就在 Cloudflare，自动接管）

## 图标

`node scripts/gen-icons.mjs` 重新生成 `public/icons/`（零依赖纯 Node，改配色改脚本顶部常量）。

## 架构要点

- `src/data/templates.json` — 135 个布局模板（1~16 张图），格式 `{g, gr:[rows,cols], c:[{r,c,s?}]}`；`s` 为可选 1-indexed 钉位
- `src/lib/templates.ts` — 模板放置（两遍法：先钉位后首个空位）、智能匹配、分割线拖拽数学
- `src/lib/geometry.ts` — cover-fit / 平移缩放 / 源图矩形换算（编辑态与导出态共用同一套数学）
- `src/lib/export.ts` — Canvas 导出管线（拼图渲染、分割、带旋转裁剪、格式/质量/文件名）
- 编辑态 DOM（grid span + overflow hidden + CSS transform），导出态离屏 Canvas 2D 任意分辨率重绘
