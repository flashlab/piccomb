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
