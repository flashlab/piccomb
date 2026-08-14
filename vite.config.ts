import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'PicComb - 免费在线拼图工具',
        short_name: 'PicComb',
        description:
          '免费在线拼图工具：布局拼图、图片分割、图片裁剪。纯本地处理，无水印免登录。',
        lang: 'zh',
        start_url: '/collage',
        display: 'standalone',
        theme_color: '#18181b',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
