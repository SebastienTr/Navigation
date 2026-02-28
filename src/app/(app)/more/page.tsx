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
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
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
      className="flex min-h-[56px] items-center gap-4 rounded-xl bg-white px-4 py-3 transition-colors active:bg-gray-50 dark:bg-gray-900 dark:active:bg-gray-800"
    >
      <Icon size={22} className="text-gray-500 dark:text-gray-400" />
      <span className="flex-1 text-base font-medium text-gray-900 dark:text-gray-100">
        {label}
      </span>
      <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
    </Link>
  )
}

const menuItems: MenuItemProps[] = [
  { href: '/briefings', icon: FileText, label: 'Briefings' },
  { href: '/checklist', icon: CheckSquare, label: 'Checklist' },
  { href: '/route', icon: Navigation, label: 'Itinéraire' },
  { href: '/reminders', icon: Bell, label: 'Rappels' },
  { href: '/settings', icon: Settings, label: 'Paramètres' },
]

export default function MorePage() {
  const { signOut } = useAuth()

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
        Plus
      </h1>

      <div className="space-y-2">
        {menuItems.map((item) => (
          <MenuItem key={item.href} {...item} />
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            signOut()
          }}
          className="flex min-h-[56px] w-full items-center gap-4 rounded-xl bg-white px-4 py-3 transition-colors active:bg-gray-50 dark:bg-gray-900 dark:active:bg-gray-800"
        >
          <LogOut size={22} className="text-red-500" />
          <span className="flex-1 text-left text-base font-medium text-red-600 dark:text-red-400">
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
