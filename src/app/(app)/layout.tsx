'use client'

import { useAuth } from '@/lib/auth/context'
import { BottomNav } from '@/components/layout/BottomNav'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner text="Chargement..." size="lg" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top)] dark:bg-gray-950">
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
