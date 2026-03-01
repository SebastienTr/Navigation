'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Route,
  FileText,
  MessageCircle,
  Menu,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavTab {
  label: string
  href: string
  icon: LucideIcon
}

const tabs: NavTab[] = [
  { label: 'Accueil', href: '/', icon: LayoutDashboard },
  { label: 'Briefing', href: '/briefings', icon: FileText },
  { label: 'Chat', href: '/chat', icon: MessageCircle },
  { label: 'Route', href: '/route', icon: Route },
  { label: 'Plus', href: '/more', icon: Menu },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/40 bg-white/80 backdrop-blur-xl dark:border-gray-800/40 dark:bg-gray-950/85">
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href)

          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon
                size={21}
                strokeWidth={isActive ? 2.5 : 1.8}
                aria-hidden="true"
              />
              <span className="leading-tight">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
