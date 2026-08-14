export interface BorderWidths {
  top: number
  right: number
  bottom: number
  left: number
}

/** defaults extracted from the reference site bundle */
export interface CollageStyle {
  spacing: number
  radius: number
  bgColor: string
  borderWidths: BorderWidths
}

export const DEFAULT_STYLE: CollageStyle = {
  spacing: 10,
  radius: 8,
  bgColor: '#FFFFFF',
  borderWidths: { top: 10, right: 10, bottom: 10, left: 10 },
}

export const STYLE_LIMITS = {
  spacing: { min: 0, max: 100 },
  radius: { min: 0, max: 100 },
  border: { min: 0, max: 200 },
} as const

/** classic background swatches shown under the color picker (devtools-style) */
export const BG_PRESETS = [
  '#FFFFFF', // 纯白
  '#FAF7F2', // 纸米
  '#F3F4F6', // 浅灰
  '#1F2937', // 炭灰
  '#000000', // 纯黑
  '#DBEAFE', // 雾蓝
  '#FCE7F3', // 樱粉
  '#D1FAE5', // 薄荷
  '#FEF3C7', // 杏黄
  '#EDE9FE', // 薰紫
] as const
