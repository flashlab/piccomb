import { useBlocker } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Confirm before SPA route changes discard loaded images.
 * Requires a data router (createBrowserRouter). Tab-close/refresh is covered
 * separately by useUnloadGuard (beforeunload).
 */
export default function LeaveGuard({ active }: { active: boolean }) {
  const { t } = useTranslation()
  const blocker = useBlocker(active)
  const open = blocker.state === 'blocked'

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) blocker.reset?.()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.leaveTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('common.leaveDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            {t('common.stay')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>
            {t('common.leave')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
