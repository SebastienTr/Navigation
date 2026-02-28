'use client'

import Link from 'next/link'
import {
  FileText,
  CheckSquare,
  Navigation,
  Bell,
  Settings,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useTheme, type Theme } from '@/lib/theme'
import type { LucideIcon } from 'lucide-react'

interface MenuItemProps {
  href: string
  icon: LucideIcon
  label: string
}

function MenuItem({ href, icon: Icon, label }: MenuItemProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[48px] items-center gap-3.5 rounded-lg bg-white px-3.5 py-2.5 transition-colors active:bg-gray-50 dark:bg-gray-900 dark:active:bg-gray-800"
    >
      <Icon size={20} className="text-gray-400 dark:text-gray-500" />
      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
        {label}
      </span>
      <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
    </Link>
  )
}

const themeOptions: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'system', label: 'Auto', icon: Monitor },
]

const menuItems: MenuItemProps[] = [
  { href: '/briefings', icon: FileText, label: 'Briefings' },
  { href: '/checklist', icon: CheckSquare, label: 'Checklist' },
  { href: '/route', icon: Navigation, label: 'Itinéraire' },
  { href: '/reminders', icon: Bell, label: 'Rappels' },
  { href: '/settings', icon: Settings, label: 'Paramètres' },
]

export default function MorePage() {
  const { signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
        Plus
      </h1>

      {/* Theme selector */}
      <section className="mb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Apparence
        </p>
        <div className="flex gap-1.5 rounded-lg bg-white p-1 dark:bg-gray-900">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                theme === value
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-gray-500 active:bg-gray-50 dark:text-gray-400 dark:active:bg-gray-800'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Menu items */}
      <div className="space-y-1.5">
        {menuItems.map((item) => (
          <MenuItem key={item.href} {...item} />
        ))}
      </div>

      {/* Sign out */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => { signOut() }}
          className="flex min-h-[48px] w-full items-center gap-3.5 rounded-lg bg-white px-3.5 py-2.5 transition-colors active:bg-gray-50 dark:bg-gray-900 dark:active:bg-gray-800"
        >
          <LogOut size={20} className="text-red-500" />
          <span className="flex-1 text-left text-sm font-medium text-red-600 dark:text-red-400">
            Déconnexion
          </span>
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
        Bosco v0.1.0
      </p>
    </div>
  )
}
