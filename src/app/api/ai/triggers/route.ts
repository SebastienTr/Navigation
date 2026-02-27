import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateTriggers, type FiredTrigger } from '@/lib/triggers/engine'
import * as webpush from 'web-push'

// ── Types ─────────────────────────────────────────────────────────────────

interface TriggerSummary {
  userId: string
  voyageId: string
  voyageName: string
  triggersFired: string[]
  notificationsSent: number
  errors: string[]
}

// ── Push notification helper ──────────────────────────────────────────────

async function sendPushNotification(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  trigger: FiredTrigger
): Promise<boolean> {
  // Get user's push subscriptions
  const { data: subscriptions, error } = await adminSupabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return false
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured — push notifications disabled.')
    return false
  }

  webpush.setVapidDetails(
    'mailto:contact@laurine-navigator.app',
    vapidPublicKey,
    vapidPrivateKey
  )

  let sent = false

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys as { p256dh: string; auth: string },
      }

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: `Alerte: ${trigger.type}`,
          body: trigger.message,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: `trigger-${trigger.type}-${Date.now()}`,
          data: { type: trigger.type },
        })
      )
      sent = true
    } catch (pushError) {
      console.error(
        `Push notification failed for subscription ${sub.endpoint}:`,
        pushError
      )

      // Remove invalid subscriptions (410 Gone)
      if (
        pushError instanceof webpush.WebPushError &&
        pushError.statusCode === 410
      ) {
        await adminSupabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
      }
    }
  }

  return sent
}

// ── GET — Cron endpoint for trigger evaluation ────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET non configure.' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorise.' },
        { status: 401 }
      )
    }

    // Check time window: only run between 6am and 10pm (Europe/Paris)
    const now = new Date()
    const parisHour = parseInt(
      new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: 'numeric',
        hour12: false,
      }).format(now),
      10
    )

    if (parisHour < 6 || parisHour > 22) {
      return NextResponse.json({
        message: `Hors fenetre horaire (${parisHour}h Paris). Triggers actifs entre 6h et 22h.`,
        evaluated: 0,
      })
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient()

    // Query all users with active voyages
    const { data: activeVoyages, error: voyagesError } = await adminSupabase
      .from('voyages')
      .select('id, user_id, name')
      .eq('status', 'active')

    if (voyagesError) {
      throw new Error(`Failed to query active voyages: ${voyagesError.message}`)
    }

    if (!activeVoyages || activeVoyages.length === 0) {
      return NextResponse.json({
        message: 'Aucun voyage actif.',
        evaluated: 0,
      })
    }

    const summaries: TriggerSummary[] = []

    // Evaluate triggers for each active voyage
    for (const voyage of activeVoyages) {
      const summary: TriggerSummary = {
        userId: voyage.user_id,
        voyageId: voyage.id,
        voyageName: voyage.name,
        triggersFired: [],
        notificationsSent: 0,
        errors: [],
      }

      try {
        // The engine handles all context gathering, weather fetching,
        // rule evaluation, and Claude message generation
        const firedTriggers = await evaluateTriggers(
          adminSupabase,
          voyage.user_id,
          voyage.id
        )

        if (firedTriggers.length === 0) {
          summaries.push(summary)
          continue
        }

        // Send push notifications for each fired trigger
        for (const trigger of firedTriggers) {
          summary.triggersFired.push(trigger.type)

          try {
            const sent = await sendPushNotification(
              adminSupabase,
              voyage.user_id,
              trigger
            )

            if (sent) {
              summary.notificationsSent++
            }
          } catch (pushError) {
            const errMsg =
              pushError instanceof Error
                ? pushError.message
                : 'Erreur notification'
            summary.errors.push(errMsg)
          }
        }
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : 'Erreur inconnue'
        summary.errors.push(errMsg)
        console.error(
          `Trigger evaluation error for voyage ${voyage.id}:`,
          errMsg
        )
      }

      summaries.push(summary)
    }

    const totalFired = summaries.reduce(
      (sum, s) => sum + s.triggersFired.length,
      0
    )
    const totalNotifications = summaries.reduce(
      (sum, s) => sum + s.notificationsSent,
      0
    )

    return NextResponse.json({
      message: `Triggers evalues pour ${activeVoyages.length} voyage(s). ${totalFired} declencheur(s), ${totalNotifications} notification(s).`,
      evaluated: activeVoyages.length,
      totalFired,
      totalNotifications,
      summaries,
    })
  } catch (error) {
    console.error('Cron triggers error:', error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Erreur cron triggers : ${message}` },
      { status: 500 }
    )
  }
}
