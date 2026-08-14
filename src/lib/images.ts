export interface LoadedImage {
  id: string
  /** object URL for <img src> */
  url: string
  el: HTMLImageElement
  w: number
  h: number
  name: string
}

let seq = 0

export function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () =>
      resolve({
        id: `img-${Date.now()}-${seq++}`,
        url,
        el,
        w: el.naturalWidth,
        h: el.naturalHeight,
        name: file.name.replace(/\.[^.]+$/, ''),
      })
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`failed to load ${file.name}`))
    }
    el.src = url
  })
}

export async function loadImageFiles(files: Iterable<File>): Promise<LoadedImage[]> {
  const list = [...files].filter((f) => f.type.startsWith('image/'))
  return Promise.all(list.map(loadImageFile))
}

export function releaseImage(img: LoadedImage): void {
  URL.revokeObjectURL(img.url)
}

/**
 * Bake horizontal/vertical flips into a fresh bitmap.
 * Rotation is handled by the crop editor itself (react-easy-crop supports
 * arbitrary angles), so only flips need bitmap-level pre-processing —
 * easy-crop has no flip support.
 */
export function flipImage(img: LoadedImage, flipH: boolean, flipV: boolean): Promise<LoadedImage> {
  const canvas = document.createElement('canvas')
  canvas.width = img.w
  canvas.height = img.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('no 2d context'))
  ctx.translate(img.w / 2, img.h / 2)
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  ctx.drawImage(img.el, -img.w / 2, -img.h / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('toBlob failed'))
      const url = URL.createObjectURL(blob)
      const el = new Image()
      el.onload = () =>
        resolve({
          id: `${img.id}-f${flipH ? 'h' : ''}${flipV ? 'v' : ''}`,
          url,
          el,
          w: el.naturalWidth,
          h: el.naturalHeight,
          name: img.name,
        })
      el.onerror = () => reject(new Error('transformed image load failed'))
      el.src = url
    }, 'image/png')
  })
}
