import type { Size } from '@/lib/geometry'

export interface SizePreset {
  id: string
  /** i18n label key under `sizes.` */
  labelKey: string
  w: number
  h: number
}

/** Common aspect-ratio presets (pixel dims chosen for social/web use) */
export const RATIO_PRESETS: SizePreset[] = [
  { id: '1:1', labelKey: 'r11', w: 2000, h: 2000 },
  { id: '4:3', labelKey: 'r43', w: 2400, h: 1800 },
  { id: '3:4', labelKey: 'r34', w: 1800, h: 2400 },
  { id: '3:2', labelKey: 'r32', w: 2400, h: 1600 },
  { id: '2:3', labelKey: 'r23', w: 1600, h: 2400 },
  { id: '16:9', labelKey: 'r169', w: 2560, h: 1440 },
  { id: '9:16', labelKey: 'r916', w: 1440, h: 2560 },
  { id: '16:10', labelKey: 'r1610', w: 2560, h: 1600 },
]

/** ID / print photo sizes for the crop tool (300dpi pixel dims) */
export interface IdPhotoPreset {
  id: string
  labelKey: string
  w: number
  h: number
}
export const ID_PHOTO_PRESETS: IdPhotoPreset[] = [
  { id: '1inch', labelKey: 'id1', w: 295, h: 413 },
  { id: 'small2', labelKey: 'idSmall2', w: 413, h: 531 },
  { id: 'cnVisa', labelKey: 'idCnVisa', w: 390, h: 567 },
  { id: 'usVisa', labelKey: 'idUsVisa', w: 600, h: 600 },
  { id: '3R', labelKey: 'id3r', w: 1051, h: 1500 },
  { id: '4R', labelKey: 'id4r', w: 1200, h: 1800 },
]

/** Print-size presets at 300dpi, extracted from the reference site */
export const PRINT_PRESETS: SizePreset[] = [
  { id: '4R', labelKey: 'p4r', w: 1200, h: 1800 },
  { id: '4R-h', labelKey: 'p4rh', w: 1800, h: 1200 },
  { id: '5R', labelKey: 'p5r', w: 1500, h: 2100 },
  { id: '5R-h', labelKey: 'p5rh', w: 2100, h: 1500 },
  { id: '8R', labelKey: 'p8r', w: 2400, h: 3000 },
  { id: '8R-h', labelKey: 'p8rh', w: 3000, h: 2400 },
  { id: 'A4', labelKey: 'pa4', w: 2480, h: 3508 },
  { id: 'A4-h', labelKey: 'pa4h', w: 3508, h: 2480 },
]

export const ALL_PRESETS: SizePreset[] = [...RATIO_PRESETS, ...PRINT_PRESETS]

export function presetSize(id: string): Size | undefined {
  const p = ALL_PRESETS.find((p) => p.id === id)
  return p ? { w: p.w, h: p.h } : undefined
}
