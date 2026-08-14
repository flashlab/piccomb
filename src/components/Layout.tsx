import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Languages, Moon, ShieldCheck, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

const LANGS = [
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
] as const

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('piccomb-theme') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    localStorage.setItem('piccomb-theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, setDark }
}

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { dark, setDark } = useDarkMode()

  const navItems = [
    { to: '/collage', label: t('common.nav.collage') },
    { to: '/split', label: t('common.nav.split') },
    { to: '/crop', label: t('common.nav.crop') },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('common.skipToContent')}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <NavLink to="/collage" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">{t('common.brand')}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t('common.tagline')}
            </span>
          </NavLink>

          <nav className="ml-4 flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 hidden items-center gap-1 text-xs text-muted-foreground md:flex">
              <ShieldCheck className="size-3.5" />
              {t('common.local')}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" aria-label={t('common.language')} />}
              >
                <Languages className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LANGS.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => void i18n.changeLanguage(l.code)}
                    className={cn(i18n.language === l.code && 'font-semibold')}
                  >
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.toggleTheme')}
              aria-pressed={dark}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <Toaster />
    </div>
  )
}
