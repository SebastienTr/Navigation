'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { BottomNav } from '@/components/layout/BottomNav'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type UserRow = Database['public']['Tables']['users']['Row']

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    const checkOnboarding = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .returns<Pick<UserRow, 'onboarding_completed'>[]>()
        .single()

      if (error) {
        console.error('Failed to check onboarding status:', error.message)
        setCheckingOnboarding(false)
        return
      }

      if (!data.onboarding_completed) {
        router.push('/onboarding')
        return
      }

      setOnboardingDone(true)
      setCheckingOnboarding(false)
    }

    checkOnboarding()
  }, [user, authLoading, router])

  if (authLoading || checkingOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner text="Chargement..." size="lg" />
      </div>
    )
  }

  if (!user || !onboardingDone) {
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
