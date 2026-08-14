import { useEffect } from 'react'

/** call handler with image files from clipboard paste events (Ctrl/Cmd+V) */
export function usePasteImages(onFiles: (files: File[]) => void) {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
        f.type.startsWith('image/'),
      )
      if (files.length === 0) return
      e.preventDefault()
      onFiles(files)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onFiles])
}
