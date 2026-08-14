import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  onFiles: (files: File[]) => void
  multiple?: boolean
  hint?: string
}

/** shared click/drag-drop upload hero used by all three tools */
export default function UploadHero({ onFiles, multiple, hint }: Props) {
  const { t } = useTranslation()
  const [dragOver, setDragOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onFiles([...e.dataTransfer.files])
      }}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-label={t('common.upload')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            input.current?.click()
          }
        }}
        className={`w-full max-w-xl cursor-pointer border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:ring-ring ${dragOver ? 'border-primary bg-accent/40' : ''}`}
        onClick={() => input.current?.click()}
      >
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ImagePlus className="size-10 text-muted-foreground" />
          <p className="font-medium">{t('common.uploadHint')}</p>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles([...e.target.files])
          e.target.value = ''
        }}
      />
    </div>
  )
}
